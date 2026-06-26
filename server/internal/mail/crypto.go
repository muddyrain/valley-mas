package mail

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

type CredentialVault struct {
	aead cipher.AEAD
}

func NewCredentialVault(secret string) (*CredentialVault, error) {
	key := []byte(secret)
	if len(key) != 32 {
		return nil, fmt.Errorf("MAIL_SECRET_KEY must be 32 bytes, got %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &CredentialVault{aead: aead}, nil
}

func (v *CredentialVault) Encrypt(plaintext string) (string, error) {
	if v == nil {
		return "", errors.New("credential vault is not configured")
	}
	nonce := make([]byte, v.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := v.aead.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

func (v *CredentialVault) Decrypt(ciphertext string) (string, error) {
	if v == nil {
		return "", errors.New("credential vault is not configured")
	}
	raw, err := base64.RawURLEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	nonceSize := v.aead.NonceSize()
	if len(raw) < nonceSize {
		return "", errors.New("credential ciphertext is too short")
	}
	plaintext, err := v.aead.Open(nil, raw[:nonceSize], raw[nonceSize:], nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
