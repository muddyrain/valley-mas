package bootstrap

import (
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"
	"syscall"
)

const maxPortProbeAttempts = 100

func ListenOnAvailablePort(preferredPort string) (net.Listener, string, error) {
	port, err := strconv.Atoi(strings.TrimSpace(preferredPort))
	if err != nil || port < 0 || port > 65535 {
		return nil, "", fmt.Errorf("invalid server port: %q", preferredPort)
	}

	var lastErr error
	for attempt := 0; attempt < maxPortProbeAttempts && port+attempt <= 65535; attempt++ {
		candidate := port + attempt
		listener, err := net.Listen("tcp", fmt.Sprintf(":%d", candidate))
		if err == nil {
			actualPort := strconv.Itoa(candidate)
			if tcpAddr, ok := listener.Addr().(*net.TCPAddr); ok && tcpAddr.Port > 0 {
				actualPort = strconv.Itoa(tcpAddr.Port)
			}
			return listener, actualPort, nil
		}
		lastErr = err
		if !isAddressInUseError(err) {
			return nil, "", err
		}
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("no available port found from %d", port)
	}
	return nil, "", lastErr
}

func isAddressInUseError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, syscall.EADDRINUSE) {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "address already in use")
}
