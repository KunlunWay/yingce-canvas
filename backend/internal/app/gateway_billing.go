package app

import (
	"net/url"
	"strings"

	"yingce/backend/internal/gatewaybilling"
	"yingce/backend/internal/model"
)

// gatewayBillingTokenFor 命中平台网关渠道时返回用户自己的计费 token；否则空串。
// 生成任务出站 key 的唯一覆盖点（蓝图 §15 二期）。
func (s *Service) gatewayBillingTokenFor(userID string, channel *model.ModelChannel) string {
	gatewayHost := gatewaybilling.GatewayHost()
	if gatewayHost == "" || channel == nil || userID == "" {
		return ""
	}
	channelHost := hostOf(channel.BaseURL)
	if channelHost == "" || channelHost != gatewayHost {
		return ""
	}
	token, err := s.repo.GatewayBillingToken(userID)
	if err != nil {
		return ""
	}
	return token
}

func hostOf(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	return strings.ToLower(u.Hostname())
}
