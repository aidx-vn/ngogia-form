package auth

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/facebook"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"

	"survey/backend/internal/config"
	"survey/backend/internal/models"
)

const stateCookie = "oauth_state"

type OAuth struct {
	cfg *config.Config
	db  *gorm.DB
}

func NewOAuth(cfg *config.Config, db *gorm.DB) *OAuth {
	return &OAuth{cfg: cfg, db: db}
}

type providerInfo struct {
	conf        *oauth2.Config
	userInfoURL string
}

func (o *OAuth) provider(name string) (*providerInfo, error) {
	redirect := fmt.Sprintf("%s/api/auth/%s/callback", o.cfg.BackendURL, name)
	switch name {
	case "google":
		if o.cfg.GoogleID == "" {
			return nil, fmt.Errorf("google oauth not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)")
		}
		return &providerInfo{
			conf: &oauth2.Config{
				ClientID:     o.cfg.GoogleID,
				ClientSecret: o.cfg.GoogleSecret,
				RedirectURL:  redirect,
				Scopes:       []string{"openid", "email", "profile"},
				Endpoint:     google.Endpoint,
			},
			userInfoURL: "https://www.googleapis.com/oauth2/v2/userinfo",
		}, nil
	case "facebook":
		if o.cfg.FacebookID == "" {
			return nil, fmt.Errorf("facebook oauth not configured (set FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET)")
		}
		return &providerInfo{
			conf: &oauth2.Config{
				ClientID:     o.cfg.FacebookID,
				ClientSecret: o.cfg.FacebookSecret,
				RedirectURL:  redirect,
				Scopes:       []string{"email", "public_profile"},
				Endpoint:     facebook.Endpoint,
			},
			userInfoURL: "https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)",
		}, nil
	}
	return nil, fmt.Errorf("unknown provider %q", name)
}

// Login redirects the browser to the provider's consent screen.
func (o *OAuth) Login(w http.ResponseWriter, r *http.Request) {
	p, err := o.provider(chi.URLParam(r, "provider"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	buf := make([]byte, 16)
	rand.Read(buf)
	state := hex.EncodeToString(buf)
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookie,
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})
	http.Redirect(w, r, p.conf.AuthCodeURL(state), http.StatusFound)
}

// Callback exchanges the code, fetches the profile, upserts the user and sets the session cookie.
func (o *OAuth) Callback(w http.ResponseWriter, r *http.Request) {
	providerName := chi.URLParam(r, "provider")
	p, err := o.provider(providerName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	stateC, err := r.Cookie(stateCookie)
	if err != nil || stateC.Value == "" || stateC.Value != r.URL.Query().Get("state") {
		http.Error(w, "invalid oauth state", http.StatusBadRequest)
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, o.cfg.FrontendURL+"/login?error=denied", http.StatusFound)
		return
	}
	token, err := p.conf.Exchange(r.Context(), code)
	if err != nil {
		http.Error(w, "token exchange failed", http.StatusBadGateway)
		return
	}
	client := p.conf.Client(r.Context(), token)
	resp, err := client.Get(p.userInfoURL)
	if err != nil {
		http.Error(w, "userinfo fetch failed", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	var info struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture json.RawMessage `json:"picture"`
	}
	if err := json.Unmarshal(body, &info); err != nil || info.ID == "" {
		http.Error(w, "invalid userinfo response", http.StatusBadGateway)
		return
	}

	avatar := ""
	if len(info.Picture) > 0 {
		// Google: picture is a plain URL string. Facebook: {"data":{"url":...}}.
		var s string
		if json.Unmarshal(info.Picture, &s) == nil {
			avatar = s
		} else {
			var fb struct {
				Data struct {
					URL string `json:"url"`
				} `json:"data"`
			}
			if json.Unmarshal(info.Picture, &fb) == nil {
				avatar = fb.Data.URL
			}
		}
	}

	user, err := o.upsertUser(providerName, info.ID, info.Email, info.Name, avatar)
	if err != nil {
		http.Error(w, "user upsert failed", http.StatusInternalServerError)
		return
	}
	o.finishLogin(w, r, user)
}

// DevLogin issues a session without a real provider. Enabled only when DEV_AUTH=1.
func (o *OAuth) DevLogin(w http.ResponseWriter, r *http.Request) {
	if !o.cfg.DevAuth {
		http.NotFound(w, r)
		return
	}
	role := r.URL.Query().Get("role")
	if role != "admin" {
		role = "user"
	}
	name := r.URL.Query().Get("name")
	if name == "" {
		name = "Dev " + strings.Title(role)
	}
	user, err := o.upsertUser("dev", "dev-"+role, "dev-"+role+"@local.test", name, "")
	if err != nil {
		http.Error(w, "user upsert failed", http.StatusInternalServerError)
		return
	}
	if user.Role != role {
		user.Role = role
		o.db.Model(user).Update("role", role)
	}
	o.finishLogin(w, r, user)
}

func (o *OAuth) upsertUser(provider, providerID, email, name, avatar string) (*models.User, error) {
	var user models.User
	err := o.db.Where("provider = ? AND provider_id = ?", provider, providerID).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		user = models.User{Provider: provider, ProviderID: providerID, Role: "user"}
		err = nil
	} else if err != nil {
		return nil, err
	}
	user.Email = email
	user.Name = name
	user.AvatarURL = avatar
	if o.cfg.AdminEmails[strings.ToLower(email)] {
		user.Role = "admin"
	}
	if err := o.db.Save(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (o *OAuth) finishLogin(w http.ResponseWriter, r *http.Request, user *models.User) {
	token, err := SignToken(o.cfg.JWTSecret, user.ID, user.Role)
	if err != nil {
		http.Error(w, "token sign failed", http.StatusInternalServerError)
		return
	}
	SetSessionCookie(w, token)
	http.SetCookie(w, &http.Cookie{Name: stateCookie, Value: "", Path: "/", MaxAge: -1})
	http.Redirect(w, r, o.cfg.FrontendURL, http.StatusFound)
}
