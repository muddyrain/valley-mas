package handler

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/smtp"
	"strings"
	"sync"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	emailCodePurposeLogin    = "login"
	emailCodePurposeRegister = "register"
	emailCodeTTL             = 10 * time.Minute
	emailCodeResendInterval  = 60 * time.Second
	emailCodeMaxAttempts     = 5
)

type emailCodeEntry struct {
	Code       string
	ExpiresAt  time.Time
	LastSentAt time.Time
	Attempts   int
}

var emailCodeCache = struct {
	mu      sync.Mutex
	entries map[string]emailCodeEntry
}{
	entries: make(map[string]emailCodeEntry),
}

func emailCodeKey(email, purpose string) string {
	return fmt.Sprintf("%s|%s", strings.ToLower(strings.TrimSpace(email)), purpose)
}

func generateNumericCode(length int) (string, error) {
	if length <= 0 {
		return "", errors.New("invalid code length")
	}
	var b strings.Builder
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		b.WriteByte(byte('0' + n.Int64()))
	}
	return b.String(), nil
}

func sendSMTPEmail(cfg *config.Config, toEmail, subject, textBody, htmlBody string) error {
	host := strings.TrimSpace(cfg.SMTP.Host)
	port := strings.TrimSpace(cfg.SMTP.Port)
	user := strings.TrimSpace(cfg.SMTP.User)
	pass := cfg.SMTP.Pass
	from := strings.TrimSpace(cfg.SMTP.FromAddress)
	fromName := strings.TrimSpace(cfg.SMTP.FromName)

	if host == "" || port == "" || user == "" || pass == "" {
		return errors.New("邮件服务未配置")
	}
	if from == "" {
		from = user
	}
	if fromName == "" {
		fromName = "Valley"
	}

	boundary := fmt.Sprintf("valley-boundary-%d", time.Now().UnixNano())
	msg := strings.Join([]string{
		fmt.Sprintf("From: %s <%s>", fromName, from),
		fmt.Sprintf("To: %s", toEmail),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		fmt.Sprintf("Content-Type: multipart/alternative; boundary=%q", boundary),
		"",
		fmt.Sprintf("--%s", boundary),
		`Content-Type: text/plain; charset="UTF-8"`,
		"Content-Transfer-Encoding: 8bit",
		"",
		textBody,
		"",
		fmt.Sprintf("--%s", boundary),
		`Content-Type: text/html; charset="UTF-8"`,
		"Content-Transfer-Encoding: 8bit",
		"",
		htmlBody,
		"",
		fmt.Sprintf("--%s--", boundary),
	}, "\r\n")

	auth := smtp.PlainAuth("", user, pass, host)
	return smtp.SendMail(fmt.Sprintf("%s:%s", host, port), auth, from, []string{toEmail}, []byte(msg))
}

func buildVerificationEmailBodies(code, actionLabel string) (string, string) {
	textBody := fmt.Sprintf(
		"Valley verification code: %s\n\nUse this code to complete %s.\nIt expires in 10 minutes.\nIf this wasn't you, please ignore this email.",
		code,
		actionLabel,
	)

	htmlBody := fmt.Sprintf(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Valley Verification Code</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Valley 验证码：%s，10 分钟内有效。</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="background:#f4f6fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 10px 30px rgba(17,24,39,0.08);">
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#111827,#1f2937);">
                <div style="font-size:12px;letter-spacing:0.08em;color:#fde68a;font-weight:700;">VALLEY SECURITY</div>
                <div style="margin-top:8px;font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;">邮箱验证码</div>
                <div style="margin-top:6px;font-size:13px;color:#d1d5db;">用于完成%s验证</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <div style="font-size:14px;color:#374151;line-height:1.75;">请在页面输入以下验证码：</div>
                <div style="margin:16px 0 14px;padding:14px 16px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;text-align:center;">
                  <span style="font-size:36px;line-height:1;font-weight:800;letter-spacing:0.25em;color:#b45309;">%s</span>
                </div>
                <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#f9fafb;border:1px solid #e5e7eb;color:#4b5563;font-size:12px;">
                  10 分钟内有效
                </div>
                <div style="margin-top:18px;font-size:13px;color:#6b7280;line-height:1.8;">
                  如果这不是你的操作，请忽略此邮件。
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px 22px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af;line-height:1.7;">
                This is an automated message from Valley. Please do not reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`, code, actionLabel, code)

	return textBody, htmlBody
}

func consumeEmailVerificationCode(email, purpose, code string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	purpose = strings.TrimSpace(purpose)
	code = strings.TrimSpace(code)
	if email == "" || purpose == "" || code == "" {
		return errors.New("验证码参数错误")
	}

	now := time.Now()
	key := emailCodeKey(email, purpose)

	emailCodeCache.mu.Lock()
	defer emailCodeCache.mu.Unlock()

	entry, ok := emailCodeCache.entries[key]
	if !ok {
		return errors.New("请先获取验证码")
	}
	if now.After(entry.ExpiresAt) {
		delete(emailCodeCache.entries, key)
		return errors.New("验证码已过期，请重新获取")
	}
	if entry.Code != code {
		entry.Attempts++
		if entry.Attempts >= emailCodeMaxAttempts {
			delete(emailCodeCache.entries, key)
			return errors.New("验证码错误次数过多，请重新获取")
		}
		emailCodeCache.entries[key] = entry
		return errors.New("验证码错误")
	}

	delete(emailCodeCache.entries, key)
	return nil
}

// SendEmailVerificationCode 发送邮箱验证码（用于登录/注册）
func SendEmailVerificationCode(cfg *config.Config) gin.HandlerFunc {
	type request struct {
		Email   string `json:"email" binding:"required,email,max=100"`
		Purpose string `json:"purpose" binding:"required,oneof=login register"`
	}

	return func(c *gin.Context) {
		var req request
		if err := c.ShouldBindJSON(&req); err != nil {
			Error(c, 400, "参数错误: "+err.Error())
			return
		}

		email := strings.ToLower(strings.TrimSpace(req.Email))
		purpose := strings.TrimSpace(req.Purpose)
		db := database.GetDB()

		var user model.User
		err := db.Where("LOWER(email) = ?", email).First(&user).Error
		if purpose == emailCodePurposeRegister {
			if err == nil {
				Error(c, 400, "该邮箱已注册")
				return
			}
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				Error(c, 500, "校验邮箱失败")
				return
			}
		}
		if purpose == emailCodePurposeLogin {
			if err != nil {
				Error(c, 400, "该邮箱未注册")
				return
			}
			if !user.IsActive {
				Error(c, 403, "账号已被禁用")
				return
			}
		}

		now := time.Now()
		key := emailCodeKey(email, purpose)

		emailCodeCache.mu.Lock()
		if old, ok := emailCodeCache.entries[key]; ok {
			if now.Sub(old.LastSentAt) < emailCodeResendInterval {
				wait := int(emailCodeResendInterval.Seconds() - now.Sub(old.LastSentAt).Seconds())
				emailCodeCache.mu.Unlock()
				Error(c, 429, fmt.Sprintf("发送过于频繁，请 %d 秒后重试", wait))
				return
			}
		}

		code, codeErr := generateNumericCode(6)
		if codeErr != nil {
			emailCodeCache.mu.Unlock()
			Error(c, 500, "生成验证码失败")
			return
		}
		emailCodeCache.entries[key] = emailCodeEntry{
			Code:       code,
			ExpiresAt:  now.Add(emailCodeTTL),
			LastSentAt: now,
			Attempts:   0,
		}
		emailCodeCache.mu.Unlock()

		subject := "Valley Verification Code"
		action := "登录"
		if purpose == emailCodePurposeRegister {
			action = "注册"
		}
		textBody, htmlBody := buildVerificationEmailBodies(code, action)

		if err := sendSMTPEmail(cfg, email, subject, textBody, htmlBody); err != nil {
			emailCodeCache.mu.Lock()
			delete(emailCodeCache.entries, key)
			emailCodeCache.mu.Unlock()
			Error(c, 500, "发送验证码失败: "+err.Error())
			return
		}

		Success(c, gin.H{"message": "验证码已发送"})
	}
}
