package handlers

import (
	"net/http"

	"gorm.io/gorm"

	"survey/backend/internal/auth"
	"survey/backend/internal/config"
	"survey/backend/internal/models"
)

type AuthHandler struct {
	cfg *config.Config
	db  *gorm.DB
}

func NewAuthHandler(cfg *config.Config, db *gorm.DB) *AuthHandler {
	return &AuthHandler{cfg: cfg, db: db}
}

// Me returns the current user, plus which login providers are configured
// so the frontend can render the right buttons.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	providers := []string{}
	if h.cfg.GoogleID != "" {
		providers = append(providers, "google")
	}
	if h.cfg.FacebookID != "" {
		providers = append(providers, "facebook")
	}
	if h.cfg.DevAuth {
		providers = append(providers, "dev")
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user":      auth.UserFrom(r.Context()),
		"providers": providers,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	auth.ClearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// DeleteAccount permanently removes the user's data and session.
func (h *AuthHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFrom(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	h.db.Where("user_id = ?", user.ID).Delete(&models.Response{})
	h.db.Delete(&models.User{}, user.ID)
	auth.ClearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
