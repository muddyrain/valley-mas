package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"math/big"
	"net/smtp"
	"strings"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	emailCodePurposeLogin    = "login"
	emailCodePurposeRegister = "register"
	emailCodePurposeReset    = "reset"
	emailCodeTTL             = 10 * time.Minute
	emailCodeResendInterval  = 60 * time.Second
	emailCodeMaxAttempts     = 5
	emailCodeIPWindow        = 15 * time.Minute
	emailCodeIPMaxRequests   = 8
)

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

	db := database.GetDB()
	var entry model.EmailVerificationCode
	if err := db.Where("email = ? AND purpose = ?", email, purpose).First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("请先获取验证码")
		}
		return errors.New("验证码校验失败，请稍后重试")
	}
	if time.Now().After(entry.ExpiresAt) {
		_ = db.Where("email = ? AND purpose = ?", email, purpose).Delete(&model.EmailVerificationCode{}).Error
		return errors.New("验证码已过期，请重新获取")
	}
	if !utils.CheckPassword(code, entry.CodeHash) {
		entry.Attempts++
		if entry.Attempts >= emailCodeMaxAttempts {
			_ = db.Where("email = ? AND purpose = ?", email, purpose).Delete(&model.EmailVerificationCode{}).Error
			return errors.New("验证码错误次数过多，请重新获取")
		}
		if err := db.Model(&entry).Update("attempts", entry.Attempts).Error; err != nil {
			return errors.New("验证码校验失败，请稍后重试")
		}
		return errors.New("验证码错误")
	}

	result := db.Where("email = ? AND purpose = ? AND code_hash = ?", email, purpose, entry.CodeHash).Delete(&model.EmailVerificationCode{})
	if result.Error != nil {
		return errors.New("验证码校验失败，请稍后重试")
	}
	if result.RowsAffected != 1 {
		return errors.New("请先获取验证码")
	}
	return nil
}

func reserveEmailCodeIP(db *gorm.DB, ip string) error {
	hash := sha256.Sum256([]byte(strings.TrimSpace(ip)))
	keyHash := fmt.Sprintf("%x", hash[:])
	now := time.Now()

	return db.Transaction(func(tx *gorm.DB) error {
		var limit model.EmailVerificationRateLimit
		err := tx.Where("key_hash = ?", keyHash).First(&limit).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return tx.Create(&model.EmailVerificationRateLimit{
				KeyHash:      keyHash,
				WindowStart:  now,
				RequestCount: 1,
			}).Error
		}
		if err != nil {
			return err
		}
		if now.Sub(limit.WindowStart) >= emailCodeIPWindow {
			return tx.Model(&limit).Updates(map[string]interface{}{
				"window_start":  now,
				"request_count": 1,
			}).Error
		}
		if limit.RequestCount >= emailCodeIPMaxRequests {
			return errors.New("验证码发送过于频繁，请稍后再试")
		}
		return tx.Model(&limit).Update("request_count", limit.RequestCount+1).Error
	})
}

// SendEmailVerificationCode 发送邮箱验证码（用于登录、注册或找回密码）
func SendEmailVerificationCode(cfg *config.Config) gin.HandlerFunc {
	type request struct {
		Email   string `json:"email" binding:"required,email,max=100"`
		Purpose string `json:"purpose" binding:"required,oneof=login register reset"`
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
		if err := reserveEmailCodeIP(db, c.ClientIP()); err != nil {
			if err.Error() == "验证码发送过于频繁，请稍后再试" {
				Error(c, 429, err.Error())
				return
			}
			Error(c, 500, "验证码服务暂时不可用")
			return
		}

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
		if purpose == emailCodePurposeReset && (errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && !user.IsActive)) {
			Success(c, gin.H{"message": "如该邮箱已注册，验证码将发送至邮箱"})
			return
		}
		if purpose == emailCodePurposeReset && err != nil {
			Error(c, 500, "校验邮箱失败")
			return
		}

		now := time.Now()
		var old model.EmailVerificationCode
		if err := db.Where("email = ? AND purpose = ?", email, purpose).First(&old).Error; err == nil {
			if now.Sub(old.LastSentAt) < emailCodeResendInterval {
				wait := int(emailCodeResendInterval.Seconds() - now.Sub(old.LastSentAt).Seconds())
				Error(c, 429, fmt.Sprintf("发送过于频繁，请 %d 秒后重试", wait))
				return
			}
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, 500, "验证码服务暂时不可用")
			return
		}

		code, codeErr := generateNumericCode(6)
		if codeErr != nil {
			Error(c, 500, "生成验证码失败")
			return
		}
		entry := model.EmailVerificationCode{
			Email:      email,
			Purpose:    purpose,
			CodeHash:   utils.HashPassword(code),
			ExpiresAt:  now.Add(emailCodeTTL),
			LastSentAt: now,
			Attempts:   0,
		}
		if err := db.Save(&entry).Error; err != nil {
			Error(c, 500, "验证码服务暂时不可用")
			return
		}

		subject := "Valley Verification Code"
		action := "登录"
		if purpose == emailCodePurposeRegister {
			action = "注册"
		} else if purpose == emailCodePurposeReset {
			action = "重置密码"
		}
		textBody, htmlBody := buildVerificationEmailBodies(code, action)

		if err := sendSMTPEmail(cfg, email, subject, textBody, htmlBody); err != nil {
			_ = db.Where("email = ? AND purpose = ?", email, purpose).Delete(&model.EmailVerificationCode{}).Error
			Error(c, 500, "发送验证码失败: "+err.Error())
			return
		}

		Success(c, gin.H{"message": "验证码已发送"})
	}
}
