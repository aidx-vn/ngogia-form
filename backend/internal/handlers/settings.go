package handlers

import (
	"encoding/json"
	"net/http"

	"gorm.io/gorm"

	"survey/backend/internal/models"
)

var allowedSettings = map[string]bool{
	"app_name":      true,
	"primary_color": true,
	"font_family":   true,
	"logo_url":      true,
}

type SettingsHandler struct {
	db *gorm.DB
}

func NewSettingsHandler(db *gorm.DB) *SettingsHandler {
	return &SettingsHandler{db: db}
}

// Get is public: the frontend needs theme values before login.
func (h *SettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	var settings []models.Setting
	if err := h.db.Find(&settings).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	out := map[string]string{}
	for _, s := range settings {
		out[s.Key] = s.Value
	}
	writeJSON(w, http.StatusOK, out)
}

// Update (admin) accepts a partial map of allowed keys.
func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	var in map[string]string
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	for k, v := range in {
		if !allowedSettings[k] {
			writeError(w, http.StatusBadRequest, "unknown setting: "+k)
			return
		}
		if len(v) > 2048 {
			writeError(w, http.StatusBadRequest, "value too long: "+k)
			return
		}
	}
	for k, v := range in {
		if err := h.db.Save(&models.Setting{Key: k, Value: v}).Error; err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
	}
	h.Get(w, r)
}
