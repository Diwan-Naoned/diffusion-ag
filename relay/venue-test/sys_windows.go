//go:build windows

package main

import (
	"os"
	"os/exec"
	"syscall"

	"golang.org/x/sys/windows"
)

func setupConsole() {
	windows.SetConsoleOutputCP(65001)
	windows.SetConsoleCP(65001)
	h := windows.Handle(os.Stdout.Fd())
	var mode uint32
	if windows.GetConsoleMode(h, &mode) == nil {
		windows.SetConsoleMode(h, mode|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING)
	}
}

// desktopDir returns the user's visible desktop (OneDrive-redirected or not).
func desktopDir() string {
	p, err := windows.KnownFolderPath(windows.FOLDERID_Desktop, 0)
	if err != nil {
		return ""
	}
	return p
}

var setThreadExecutionState = windows.NewLazySystemDLL("kernel32.dll").NewProc("SetThreadExecutionState")

// keepAwake prevents sleep and screen-off while the test runs.
func keepAwake() {
	const esContinuous, esSystem, esDisplay = 0x80000000, 0x00000001, 0x00000002
	setThreadExecutionState.Call(uintptr(esContinuous | esSystem | esDisplay))
}

// wifiInfo returns the raw output of "netsh wlan show interfaces".
func wifiInfo() string {
	cmd := exec.Command("netsh", "wlan", "show", "interfaces")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.CombinedOutput()
	if err != nil && len(out) == 0 {
		return "netsh: " + err.Error()
	}
	return decodeOEM(out)
}

// decodeOEM converts netsh output (OEM code page, usually 850 in France) to UTF-8.
func decodeOEM(b []byte) string {
	cp850 := []rune("ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ")
	out := make([]rune, 0, len(b))
	for _, c := range b {
		if c < 0x80 {
			out = append(out, rune(c))
		} else {
			out = append(out, cp850[c-0x80])
		}
	}
	return string(out)
}
