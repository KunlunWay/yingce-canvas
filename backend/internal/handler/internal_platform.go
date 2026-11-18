// 平台镜像内部端点（fork 集成）：GlowPix 后端以 xstudio-composite-runtime-v1
// 签名调用（与网关计费接缝同一签名方案），按 OIDC 账号哈希读取该用户作品与存储用量。
// 无浏览器会话参与；密钥缺失时端点整体不可用（503）。

package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func RegisterInternalPlatformRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/internal/works", func(c *gin.Context) {
		account := verifyInternalPlatformRequest(c)
		if account == "" {
			return
		}
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "40"))
		result, err := svc.PlatformWorksByOIDCAccount(account, page, pageSize)
		if err != nil {
			fail(c, http.StatusNotFound, service.BadAuthRequest("账号不存在"))
			return
		}
		works := make([]gin.H, 0, len(result.Assets))
		for _, raw := range result.Assets {
			var payload map[string]any
			if json.Unmarshal(raw, &payload) != nil {
				continue
			}
			works = append(works, gin.H{
				"id":         payload["id"],
				"title":      payload["title"],
				"kind":       payload["kind"],
				"category":   payload["category"],
				"previewUrl": internalWorkPreviewURL(payload),
				"updatedAt":  payload["updatedAt"],
			})
		}
		ok(c, gin.H{"works": works, "page": result.Page, "pageSize": result.PageSize, "total": result.Total, "hasMore": result.HasMore})
	})
	r.GET("/internal/storage", func(c *gin.Context) {
		account := verifyInternalPlatformRequest(c)
		if account == "" {
			return
		}
		usage, err := svc.PlatformStorageByOIDCAccount(account)
		if err != nil {
			fail(c, http.StatusNotFound, service.BadAuthRequest("账号不存在"))
			return
		}
		ok(c, gin.H{"usage": usage})
	})
}

// verifyInternalPlatformRequest 校验 xstudio-composite-runtime-v1 签名并返回账号哈希。
// 签名覆盖 method + RequestURI（含查询串），空请求体的 sha256 固定。
func verifyInternalPlatformRequest(c *gin.Context) string {
	secret := strings.TrimSpace(os.Getenv("CANVAS_INTERNAL_API_SECRET"))
	key, err := hex.DecodeString(secret)
	if secret == "" || err != nil || len(key) != 32 {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return ""
	}
	timestamp := c.GetHeader("X-XStudio-Runtime-Time")
	signature := c.GetHeader("X-XStudio-Runtime-Signature")
	issued, err := strconv.ParseInt(timestamp, 10, 64)
	now := time.Now().Unix()
	if err != nil || issued > now+5 || issued < now-30 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return ""
	}
	provided, err := hex.DecodeString(signature)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return ""
	}
	digest := sha256.Sum256(nil)
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte("xstudio-composite-runtime-v1\n" + timestamp + "\n" + c.Request.Method + "\n" + c.Request.URL.RequestURI() + "\n" + hex.EncodeToString(digest[:])))
	if !hmac.Equal(provided, mac.Sum(nil)) {
		c.AbortWithStatus(http.StatusUnauthorized)
		return ""
	}
	account := strings.TrimSpace(c.Query("account"))
	if len(account) != 64 {
		c.AbortWithStatus(http.StatusBadRequest)
		return ""
	}
	return account
}

// internalWorkPreviewURL 从客户端素材负载提取卡片预览地址；resource: 存储键
// 换成同站会话可直接访问的资源文件地址，http(s) 直链原样保留。
func internalWorkPreviewURL(payload map[string]any) string {
	candidates := []string{}
	if cover, ok := payload["coverUrl"].(string); ok {
		candidates = append(candidates, cover)
	}
	if data, ok := payload["data"].(map[string]any); ok {
		for _, key := range []string{"url", "dataUrl", "coverStorageKey"} {
			if value, ok := data[key].(string); ok {
				candidates = append(candidates, value)
			}
		}
	}
	if cover, ok := payload["coverStorageKey"].(string); ok {
		candidates = append(candidates, cover)
	}
	for _, value := range candidates {
		if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
			return value
		}
		if id, found := strings.CutPrefix(value, "resource:"); found && id != "" {
			return "/api/resources/" + id + "/file"
		}
	}
	return ""
}
