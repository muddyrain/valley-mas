package mail

import "testing"

func TestCredentialVaultEncryptsAndDecrypts(t *testing.T) {
	vault, err := NewCredentialVault("12345678901234567890123456789012")
	if err != nil {
		t.Fatalf("new vault: %v", err)
	}

	ciphertext, err := vault.Encrypt("qq-mail-app-password")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if ciphertext == "" || ciphertext == "qq-mail-app-password" {
		t.Fatalf("credential should be encrypted, got %q", ciphertext)
	}

	plaintext, err := vault.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if plaintext != "qq-mail-app-password" {
		t.Fatalf("unexpected plaintext %q", plaintext)
	}
}

func TestCredentialVaultRejectsShortSecret(t *testing.T) {
	if _, err := NewCredentialVault("short"); err == nil {
		t.Fatal("expected short secret to be rejected")
	}
}
