package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"

	"survey/backend/internal/models"
)

type AdminHandler struct {
	db *gorm.DB
}

func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

func (h *AdminHandler) surveyByID(w http.ResponseWriter, r *http.Request) *models.Survey {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return nil
	}
	var survey models.Survey
	if err := h.db.First(&survey, id).Error; err != nil {
		writeError(w, http.StatusNotFound, "survey not found")
		return nil
	}
	return &survey
}

// --- Surveys CRUD ---

func (h *AdminHandler) ListSurveys(w http.ResponseWriter, r *http.Request) {
	var surveys []models.Survey
	if err := h.db.Order("created_at DESC").Find(&surveys).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	type item struct {
		models.Survey
		ResponseCount int64 `json:"response_count"`
	}
	items := make([]item, 0, len(surveys))
	for _, s := range surveys {
		var n int64
		h.db.Model(&models.Response{}).Where("survey_id = ?", s.ID).Count(&n)
		items = append(items, item{Survey: s, ResponseCount: n})
	}
	writeJSON(w, http.StatusOK, items)
}

type surveyInput struct {
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Status      string          `json:"status"`
	Schema      json.RawMessage `json:"schema"`
}

func validStatus(s string) bool {
	return s == "draft" || s == "active" || s == "closed"
}

func (in *surveyInput) validate() string {
	if in.Title == "" {
		return "title is required"
	}
	if !validStatus(in.Status) {
		return "status must be draft, active or closed"
	}
	var schema models.SurveySchema
	if err := json.Unmarshal(in.Schema, &schema); err != nil {
		return "schema must be valid JSON with a questions array"
	}
	seen := map[string]bool{}
	for _, q := range schema.Questions {
		if q.ID == "" || q.Label == "" {
			return "every question needs an id and a label"
		}
		if seen[q.ID] {
			return "duplicate question id: " + q.ID
		}
		seen[q.ID] = true
		switch q.Type {
		case "single_choice", "multiple_choice":
			if len(q.Options) == 0 {
				return "question " + q.ID + ": choice questions need options"
			}
		case "text", "textarea", "rating", "scale", "number", "date":
		default:
			return "question " + q.ID + ": unknown type " + q.Type
		}
	}
	return ""
}

func (h *AdminHandler) CreateSurvey(w http.ResponseWriter, r *http.Request) {
	var in surveyInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Status == "" {
		in.Status = "draft"
	}
	if msg := in.validate(); msg != "" {
		writeError(w, http.StatusUnprocessableEntity, msg)
		return
	}
	survey := models.Survey{Title: in.Title, Description: in.Description, Status: in.Status, Schema: []byte(in.Schema)}
	if err := h.db.Create(&survey).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusCreated, survey)
}

func (h *AdminHandler) GetSurvey(w http.ResponseWriter, r *http.Request) {
	survey := h.surveyByID(w, r)
	if survey == nil {
		return
	}
	writeJSON(w, http.StatusOK, survey)
}

func (h *AdminHandler) UpdateSurvey(w http.ResponseWriter, r *http.Request) {
	survey := h.surveyByID(w, r)
	if survey == nil {
		return
	}
	var in surveyInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := in.validate(); msg != "" {
		writeError(w, http.StatusUnprocessableEntity, msg)
		return
	}
	survey.Title = in.Title
	survey.Description = in.Description
	survey.Status = in.Status
	survey.Schema = []byte(in.Schema)
	if err := h.db.Save(survey).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, survey)
}

func (h *AdminHandler) DeleteSurvey(w http.ResponseWriter, r *http.Request) {
	survey := h.surveyByID(w, r)
	if survey == nil {
		return
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("survey_id = ?", survey.ID).Delete(&models.Response{}).Error; err != nil {
			return err
		}
		return tx.Delete(survey).Error
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Responses & stats ---

func (h *AdminHandler) ListResponses(w http.ResponseWriter, r *http.Request) {
	survey := h.surveyByID(w, r)
	if survey == nil {
		return
	}
	var responses []models.Response
	if err := h.db.Preload("User").Where("survey_id = ?", survey.ID).Order("created_at DESC").Find(&responses).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, responses)
}

// SurveyStats aggregates answers per question for charts.
func (h *AdminHandler) SurveyStats(w http.ResponseWriter, r *http.Request) {
	survey := h.surveyByID(w, r)
	if survey == nil {
		return
	}
	var schema models.SurveySchema
	if err := json.Unmarshal(survey.Schema, &schema); err != nil {
		writeError(w, http.StatusInternalServerError, "broken survey schema")
		return
	}
	var responses []models.Response
	h.db.Where("survey_id = ?", survey.ID).Find(&responses)

	parsed := make([]map[string]any, 0, len(responses))
	for _, resp := range responses {
		var answers map[string]any
		if json.Unmarshal(resp.Answers, &answers) == nil {
			parsed = append(parsed, answers)
		}
	}

	type questionStats struct {
		ID      string             `json:"id"`
		Type    string             `json:"type"`
		Label   string             `json:"label"`
		Counts  map[string]int     `json:"counts,omitempty"`  // choice value -> count
		Average *float64           `json:"average,omitempty"` // numeric questions
		Dist    map[string]int     `json:"distribution,omitempty"`
		Texts   []string           `json:"texts,omitempty"` // latest free-text answers
		Options []models.Option    `json:"options,omitempty"`
		Total   int                `json:"total"`
	}

	stats := make([]questionStats, 0, len(schema.Questions))
	for _, q := range schema.Questions {
		qs := questionStats{ID: q.ID, Type: q.Type, Label: q.Label, Options: q.Options}
		switch q.Type {
		case "single_choice":
			qs.Counts = map[string]int{}
			for _, a := range parsed {
				if v, ok := a[q.ID].(string); ok {
					qs.Counts[v]++
					qs.Total++
				}
			}
		case "multiple_choice":
			qs.Counts = map[string]int{}
			for _, a := range parsed {
				if arr, ok := a[q.ID].([]any); ok {
					for _, item := range arr {
						if v, ok := item.(string); ok {
							qs.Counts[v]++
						}
					}
					qs.Total++
				}
			}
		case "rating", "scale", "number":
			qs.Dist = map[string]int{}
			sum := 0.0
			for _, a := range parsed {
				if v, ok := a[q.ID].(float64); ok {
					sum += v
					qs.Dist[strconv.FormatFloat(v, 'f', -1, 64)]++
					qs.Total++
				}
			}
			if qs.Total > 0 {
				avg := sum / float64(qs.Total)
				qs.Average = &avg
			}
		case "text", "textarea", "date":
			for _, a := range parsed {
				if v, ok := a[q.ID].(string); ok && v != "" {
					qs.Total++
					if len(qs.Texts) < 50 {
						qs.Texts = append(qs.Texts, v)
					}
				}
			}
		}
		stats = append(stats, qs)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"survey":         survey,
		"response_count": len(responses),
		"questions":      stats,
	})
}

// Dashboard returns the global numbers for the admin home page.
func (h *AdminHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	var totalSurveys, activeSurveys, totalResponses, totalUsers int64
	h.db.Model(&models.Survey{}).Count(&totalSurveys)
	h.db.Model(&models.Survey{}).Where("status = ?", "active").Count(&activeSurveys)
	h.db.Model(&models.Response{}).Count(&totalResponses)
	h.db.Model(&models.User{}).Count(&totalUsers)

	// Responses per day, last 14 days.
	since := time.Now().AddDate(0, 0, -13).Truncate(24 * time.Hour)
	var rows []struct {
		Day   time.Time
		Count int64
	}
	h.db.Model(&models.Response{}).
		Select("date_trunc('day', created_at) AS day, count(*) AS count").
		Where("created_at >= ?", since).
		Group("day").Order("day").Scan(&rows)

	byDay := map[string]int64{}
	for _, row := range rows {
		byDay[row.Day.Format("2006-01-02")] = row.Count
	}
	type dayPoint struct {
		Day   string `json:"day"`
		Count int64  `json:"count"`
	}
	days := make([]dayPoint, 0, 14)
	for i := 0; i < 14; i++ {
		d := since.AddDate(0, 0, i).Format("2006-01-02")
		days = append(days, dayPoint{Day: d, Count: byDay[d]})
	}

	var recent []models.Response
	h.db.Preload("User").Order("created_at DESC").Limit(10).Find(&recent)

	writeJSON(w, http.StatusOK, map[string]any{
		"total_surveys":    totalSurveys,
		"active_surveys":   activeSurveys,
		"total_responses":  totalResponses,
		"total_users":      totalUsers,
		"responses_by_day": days,
		"recent_responses": recent,
	})
}
