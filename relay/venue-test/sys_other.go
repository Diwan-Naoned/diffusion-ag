//go:build !windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

func setupConsole() {}

func keepAwake() {}

func desktopDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	p := filepath.Join(home, "Desktop")
	if st, err := os.Stat(p); err == nil && st.IsDir() {
		return p
	}
	return ""
}

func wifiInfo() string {
	if runtime.GOOS == "darwin" {
		out, _ := exec.Command("sh", "-c", "networksetup -getairportnetwork en0; ipconfig getsummary en0 2>/dev/null | grep -E ' SSID|RSSI|Channel|PHY' ").CombinedOutput()
		return string(out)
	}
	return ""
}
