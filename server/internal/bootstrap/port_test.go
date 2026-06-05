package bootstrap

import (
	"net"
	"strconv"
	"testing"
)

func TestListenOnAvailablePortUsesPreferredPort(t *testing.T) {
	probe, err := net.Listen("tcp", ":0")
	if err != nil {
		t.Fatalf("open probe listener: %v", err)
	}
	port := probe.Addr().(*net.TCPAddr).Port
	if err := probe.Close(); err != nil {
		t.Fatalf("close probe listener: %v", err)
	}

	listener, actualPort, err := ListenOnAvailablePort(strconv.Itoa(port))
	if err != nil {
		t.Fatalf("listen on preferred port: %v", err)
	}
	defer listener.Close()

	if actualPort != strconv.Itoa(port) {
		t.Fatalf("expected preferred port %d, got %s", port, actualPort)
	}
}

func TestListenOnAvailablePortSkipsOccupiedPort(t *testing.T) {
	first, err := net.Listen("tcp", ":0")
	if err != nil {
		t.Fatalf("open occupied listener: %v", err)
	}
	defer first.Close()

	firstPort := first.Addr().(*net.TCPAddr).Port
	second, err := net.Listen("tcp", ":"+strconv.Itoa(firstPort+1))
	if err != nil {
		t.Skipf("cannot reserve adjacent port for deterministic test: %v", err)
	}
	secondPort := second.Addr().(*net.TCPAddr).Port
	if err := second.Close(); err != nil {
		t.Fatalf("close adjacent probe listener: %v", err)
	}

	listener, actualPort, err := ListenOnAvailablePort(strconv.Itoa(firstPort))
	if err != nil {
		t.Fatalf("listen on fallback port: %v", err)
	}
	defer listener.Close()

	if actualPort != strconv.Itoa(secondPort) {
		t.Fatalf("expected fallback port %d, got %s", secondPort, actualPort)
	}
}

func TestListenOnAvailablePortRejectsInvalidPort(t *testing.T) {
	if _, _, err := ListenOnAvailablePort("not-a-port"); err == nil {
		t.Fatal("expected invalid port error")
	}
}
