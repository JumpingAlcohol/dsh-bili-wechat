"""Normalize message-bound Bilibili appmsg/5 cards; no network or file access."""
import re
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit

BILIBILI_CARD_TYPE = (5 << 32) | 49
BILIBILI_VIDEO_CARD_TYPE = (4 << 32) | 49
HOSTS = {'b23.tv', 'www.b23.tv', 'bilibili.com', 'www.bilibili.com', 'm.bilibili.com'}

def parse_bilibili_card(kind, raw):
    if kind not in (49, BILIBILI_CARD_TYPE, BILIBILI_VIDEO_CARD_TYPE) or not isinstance(raw, str) or len(raw) > 131072:
        return None
    if '<!DOCTYPE' in raw.upper() or '<!ENTITY' in raw.upper():
        return None
    try:
        root = ET.fromstring(raw)
        app = root if root.tag == 'appmsg' else root.find('appmsg') if root.tag == 'msg' else None
        if app is None or app.findtext('type') not in ('4', '5'):
            return None
        url = (app.findtext('url') or '').strip()
        parsed = urlsplit(url)
        if len(url) > 2048 or parsed.scheme != 'https' or parsed.hostname not in HOSTS or parsed.username or parsed.password or parsed.port:
            return None
        if parsed.hostname not in {'b23.tv', 'www.b23.tv'} and not re.search(r'/video/BV[0-9A-Za-z]{10}(?:/|$)', parsed.path):
            return None
        title = re.sub(r'\s+', ' ', app.findtext('title') or 'B站视频')[:140]
        return {'title': title, 'url': url, 'text': '[B站视频分享] ' + title + '\n' + url}
    except (ET.ParseError, ValueError, TypeError):
        return None
