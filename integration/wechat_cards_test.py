import importlib.util
import pathlib
import hashlib
import sqlite3
import sys
import os
import unittest
from unittest.mock import patch

SCRIPTS = pathlib.Path(os.environ['WECHATAGENT_WORKSPACE']) / 'scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('reader_api_bili_tests', SCRIPTS / 'reader-api.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)

def message(xml, kind=49):
    return {'localType': kind, 'senderUsername': 'wxid_friend', 'fullText': xml,
            'isSend': False, 'localId': 123, 'serverId': '456', 'createTime': 1792900000}

def push(xml, kind=49):
    return reader.push_payload('test@chatroom', message(xml, kind),
                               {'test@chatroom': '测试'}, 'wxid_bot', '12345')

class BilibiliCards(unittest.TestCase):
    def test_mobile_video_card_type_four_is_supported(self):
        xml = '<msg><appmsg><title>抽象视频</title><type>4</type><url>https://b23.tv/abc123</url></appmsg></msg>'
        event = push(xml, (4 << 32) | 49)
        self.assertIsNotNone(event, 'mobile Bilibili appmsg/4 card is dropped')
        self.assertIn('https://b23.tv/abc123', event['content'])

    def test_reader_preserves_compressed_or_blob_card_content_before_push_conversion(self):
        talker = 'test@chatroom'
        table = 'Msg_' + hashlib.md5(talker.encode()).hexdigest()
        for subtype in (4, 5):
            xml = f'<msg><appmsg><title>测试分享</title><type>{subtype}</type><url>https://b23.tv/abc123</url></appmsg></msg>'
            con = sqlite3.connect(':memory:')
            con.execute(f'CREATE TABLE "{table}" (local_id INTEGER, create_time INTEGER, server_id INTEGER, message_content BLOB)')
            con.execute(f'INSERT INTO "{table}" VALUES (123, 1792900000, 456, ?)', (xml.encode(),))
            obj = reader.Reader.__new__(reader.Reader)
            obj.names = {talker: '测试'}
            obj.own_wxid = 'wxid_bot'
            obj.selected_talkers = lambda: [talker]
            obj.open_messages = lambda: [con]
            row = message('', (subtype << 32) | 49)
            with patch.object(reader.nt, 'get_messages', return_value={'messages': [row]}), patch.object(reader.nt, 'msg_tables', return_value=[table]):
                result = obj.messages(talker)
            self.assertIn('https://b23.tv/abc123', result[0].get('fullText', ''), 'card BLOB must be decoded before the receiver filters it')
            self.assertIsNotNone(reader.push_payload(talker, result[0], obj.names, obj.own_wxid, '12345'))

    def test_bilibili_link_card_becomes_readable_title_and_url(self):
        xml = '<msg><appmsg><title>猫猫整活</title><des>简介</des><type>5</type><url><![CDATA[https://b23.tv/abc123]]></url></appmsg></msg>'
        for kind in (49, (5 << 32) | 49):
            event = push(xml, kind)
            self.assertIsNotNone(event, 'Bilibili card is currently dropped')
            self.assertIn('https://b23.tv/abc123', event['content'])
            self.assertIn('猫猫整活', event['content'])
            self.assertNotIn('<appmsg', event['content'])
            self.assertEqual(event['conversationId'], '12345')

    def test_unrelated_or_deceptive_share_cards_remain_unsupported(self):
        for url in ['https://example.com/video/BV1T5n66mEa2',
                    'https://www.bilibili.com.evil.invalid/video/BV1T5n66mEa2',
                    'http://127.0.0.1/secret']:
            xml = '<msg><appmsg><title>分享</title><type>5</type><url>' + url + '</url></appmsg></msg>'
            self.assertIsNone(push(xml))

    def test_malformed_or_entity_xml_is_not_treated_as_a_video(self):
        self.assertIsNone(push('<msg><appmsg>'))
        xml = '<!DOCTYPE msg [<!ENTITY title SYSTEM "file:///C:/secret">]><msg><appmsg><title>&title;</title><type>5</type><url>https://b23.tv/abc123</url></appmsg></msg>'
        self.assertIsNone(push(xml))

if __name__ == '__main__':
    unittest.main()
