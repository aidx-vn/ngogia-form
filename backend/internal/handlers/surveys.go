package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"

	"survey/backend/internal/auth"
	"survey/backend/internal/models"
)

type SurveysHandler struct {
	db *gorm.DB
}

func NewSurveysHandler(db *gorm.DB) *SurveysHandler {
	return &SurveysHandler{db: db}
}

type surveyListItem struct {
	ID            uint      `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	Status        string    `json:"status"`
	QuestionCount int       `json:"question_count"`
	Answered      bool      `json:"answered"`
	CreatedAt     time.Time `json:"created_at"`
}

// List returns active surveys with an "answered" flag for the current user.
func (h *SurveysHandler) List(w http.ResponseWriter, r *http.Request) {
	var surveys []models.Survey
	if err := h.db.Where("status = ?", "active").Order("created_at DESC").Find(&surveys).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	user := auth.UserFrom(r.Context())
	answered := map[uint]bool{}
	if user != nil {
		var responses []models.Response
		h.db.Where("user_id = ?", user.ID).Find(&responses)
		for _, resp := range responses {
			answered[resp.SurveyID] = true
		}
	}
	items := make([]surveyListItem, 0, len(surveys))
	for _, s := range surveys {
		var schema models.SurveySchema
		json.Unmarshal(s.Schema, &schema)
		items = append(items, surveyListItem{
			ID:            s.ID,
			Title:         s.Title,
			Description:   s.Description,
			Status:        s.Status,
			QuestionCount: len(schema.Questions),
			Answered:      answered[s.ID],
			CreatedAt:     s.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *SurveysHandler) loadSurvey(w http.ResponseWriter, r *http.Request, requireActive bool) *models.Survey {
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
	if requireActive && survey.Status != "active" {
		user := auth.UserFrom(r.Context())
		if user == nil || user.Role != "admin" {
			writeError(w, http.StatusNotFound, "survey not found")
			return nil
		}
	}
	return &survey
}

func (h *SurveysHandler) Get(w http.ResponseWriter, r *http.Request) {
	survey := h.loadSurvey(w, r, true)
	if survey == nil {
		return
	}
	writeJSON(w, http.StatusOK, survey)
}

// MyResponse returns the current user's response for a survey, or null.
func (h *SurveysHandler) MyResponse(w http.ResponseWriter, r *http.Request) {
	survey := h.loadSurvey(w, r, true)
	if survey == nil {
		return
	}
	user := auth.UserFrom(r.Context())
	var resp models.Response
	if err := h.db.Where("survey_id = ? AND user_id = ?", survey.ID, user.ID).First(&resp).Error; err != nil {
		writeJSON(w, http.StatusOK, nil)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// Submit validates answers against the survey schema and stores one response per user.
func (h *SurveysHandler) Submit(w http.ResponseWriter, r *http.Request) {
	survey := h.loadSurvey(w, r, true)
	if survey == nil {
		return
	}
	if survey.Status != "active" {
		writeError(w, http.StatusConflict, "survey is not accepting responses")
		return
	}
	user := auth.UserFrom(r.Context())

	var in struct {
		Answers map[string]json.RawMessage `json:"answers"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	var schema models.SurveySchema
	if err := json.Unmarshal(survey.Schema, &schema); err != nil {
		writeError(w, http.StatusInternalServerError, "broken survey schema")
		return
	}
	cleaned, verr := validateAnswers(schema.Questions, in.Answers)
	if verr != "" {
		writeError(w, http.StatusUnprocessableEntity, verr)
		return
	}
	answersJSON, _ := json.Marshal(cleaned)

	var existing models.Response
	if err := h.db.Where("survey_id = ? AND user_id = ?", survey.ID, user.ID).First(&existing).Error; err == nil {
		writeError(w, http.StatusConflict, "already answered")
		return
	}
	resp := models.Response{SurveyID: survey.ID, UserID: user.ID, Answers: answersJSON}
	if err := h.db.Create(&resp).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	// Persist string answers as user profile so future surveys can pre-fill them.
	go h.saveProfile(user.ID, cleaned)

	writeJSON(w, http.StatusCreated, resp)
}

func (h *SurveysHandler) saveProfile(userID uint, answers map[string]any) {
	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		return
	}
	profile := map[string]string{}
	if len(user.Profile) > 0 {
		json.Unmarshal(user.Profile, &profile)
	}
	for k, v := range answers {
		if s, ok := v.(string); ok && s != "" {
			profile[k] = s
		}
	}
	if b, err := json.Marshal(profile); err == nil {
		h.db.Model(&user).Update("profile", b)
	}
}

// validateAnswers checks each answer against its question definition and
// returns the cleaned answer map (unknown question IDs dropped).
func validateAnswers(questions []models.Question, answers map[string]json.RawMessage) (map[string]any, string) {
	cleaned := map[string]any{}
	for _, q := range questions {
		raw, ok := answers[q.ID]
		if !ok || string(raw) == "null" {
			if q.Required {
				return nil, fmt.Sprintf("question %q is required", q.ID)
			}
			continue
		}
		switch q.Type {
		case "single_choice":
			var v string
			if json.Unmarshal(raw, &v) != nil || !hasOption(q.Options, v) {
				return nil, fmt.Sprintf("question %q: invalid choice", q.ID)
			}
			cleaned[q.ID] = v
		case "multiple_choice":
			var v []string
			if json.Unmarshal(raw, &v) != nil {
				return nil, fmt.Sprintf("question %q: expected array", q.ID)
			}
			if q.Required && len(v) == 0 {
				return nil, fmt.Sprintf("question %q is required", q.ID)
			}
			seen := map[string]bool{}
			for _, item := range v {
				if !hasOption(q.Options, item) || seen[item] {
					return nil, fmt.Sprintf("question %q: invalid choice", q.ID)
				}
				seen[item] = true
			}
			cleaned[q.ID] = v
		case "text", "textarea":
			var v string
			if json.Unmarshal(raw, &v) != nil || len(v) > 5000 {
				return nil, fmt.Sprintf("question %q: invalid text", q.ID)
			}
			if q.Required && v == "" {
				return nil, fmt.Sprintf("question %q is required", q.ID)
			}
			cleaned[q.ID] = v
		case "rating", "scale", "number":
			var v float64
			if json.Unmarshal(raw, &v) != nil {
				return nil, fmt.Sprintf("question %q: expected number", q.ID)
			}
			if q.Min != nil && v < *q.Min {
				return nil, fmt.Sprintf("question %q: below minimum", q.ID)
			}
			if q.Max != nil && v > *q.Max {
				return nil, fmt.Sprintf("question %q: above maximum", q.ID)
			}
			cleaned[q.ID] = v
		case "date":
			var v string
			if json.Unmarshal(raw, &v) != nil {
				return nil, fmt.Sprintf("question %q: expected string date", q.ID)
			}
			if _, err := time.Parse("2006-01-02", v); err != nil {
				return nil, fmt.Sprintf("question %q: expected YYYY-MM-DD", q.ID)
			}
			cleaned[q.ID] = v
		default:
			return nil, fmt.Sprintf("question %q: unknown type %q", q.ID, q.Type)
		}
	}
	return cleaned, ""
}

func hasOption(options []models.Option, value string) bool {
	for _, o := range options {
		if o.Value == value {
			return true
		}
	}
	return false
}
