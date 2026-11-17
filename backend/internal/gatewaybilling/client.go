// Package gatewaybilling 是 GlowPix 平台网关计费接缝的 fork 集成包：
// OIDC 首开时为该用户向平台网关配发一把 API token（用量计入用户额度）。
// 三个环境变量全部设置才启用：CANVAS_GATEWAY_BILLING_URL（网关源）、
// CANVAS_GATEWAY_BILLING_SECRET（composite 签名密钥 hex）、
// CANVAS_GATEWAY_BILLING_NAMESPACE（身份命名空间）。
package gatewaybilling

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const tokenPath = "/api/xstudio/yingce-token"

// Enabled 报告三个环境变量是否齐备。
func Enabled() bool {
	origin, secret, namespace, ok := config()
	return ok && origin != "" && secret != "" && namespace != ""
}

// GatewayHost 返回平台网关主机名（小写），供渠道命中判断。
func GatewayHost() string {
	origin, _, _, ok := config()
	if !ok {
		return ""
	}
	u, err := url.Parse(origin)
	if err != nil {
		return ""
	}
	return strings.ToLower(u.Hostname())
}

// ProvisionToken 向平台网关配发/复用该用户的 token；返回 token 明文。
// 签名契约与平台侧 xstudio-composite-runtime-v1 一致。
func ProvisionToken(ctx context.Context, gatewayUserID string) (string, error) {
	origin, secret, namespace, ok := config()
	if !ok {
		return "", errors.New("gateway billing not configured")
	}
	key, err := hex.DecodeString(secret)
	if err != nil || len(key) != 32 {
		return "", errors.New("gateway billing secret misconfigured")
	}
	var gatewayUser int
	if _, err := fmt.Sscanf(gatewayUserID, "%d", &gatewayUser); err != nil || gatewayUser < 1 {
		return "", errors.New("gateway user id invalid")
	}
	body, err := json.Marshal(map[string]any{"user_id": gatewayUser, "namespace": namespace})
	if err != nil {
		return "", err
	}
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	digest := sha256.Sum256(body)
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte("xstudio-composite-runtime-v1\n" + timestamp + "\nPOST\n" + tokenPath + "\n" + hex.EncodeToString(digest[:])))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, origin+tokenPath, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-XStudio-Runtime-Time", timestamp)
	req.Header.Set("X-XStudio-Runtime-Signature", hex.EncodeToString(mac.Sum(nil)))
	// 目标地址来自部署方环境变量（非用户输入），不经出站 SSRF 校验。
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", errors.New("gateway billing token provisioning rejected")
	}
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil || payload.Token == "" {
		return "", errors.New("gateway billing token response invalid")
	}
	return payload.Token, nil
}

func config() (origin, secret, namespace string, ok bool) {
	origin = strings.TrimRight(strings.TrimSpace(os.Getenv("CANVAS_GATEWAY_BILLING_URL")), "/")
	secret = strings.TrimSpace(os.Getenv("CANVAS_GATEWAY_BILLING_SECRET"))
	namespace = strings.TrimSpace(os.Getenv("CANVAS_GATEWAY_BILLING_NAMESPACE"))
	ok = origin != "" && secret != "" && namespace != ""
	return
}
