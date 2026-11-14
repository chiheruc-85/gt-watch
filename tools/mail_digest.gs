/**
 * 中国ガスタービン・ウォッチ 新着号メール配信（Google Apps Script）
 *
 * 使い方：
 *  1. Googleスプレッドシートを新規作成し、1行目に「メールアドレス」「状態」と入力する。
 *     2行目以降のA列に配信先のメールアドレスを入力する（B列に「停止」と入れるとその人への配信を止める）。
 *  2. スプレッドシートのメニュー「拡張機能 → Apps Script」を開き、このコードを全部貼り付けて保存する。
 *  3. 関数「sendTest」を選んで実行（初回は権限の承認が必要）。自分宛てにテストメールが届く。
 *  4. 関数「setupTrigger」を1回だけ実行する。以降、毎朝8時（中国時間）に自動で配信される。
 */
const SITE = 'https://chiheruc-85.github.io/gt-watch/';

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fetchLatest_() {
  const res = UrlFetchApp.fetch(SITE + 'editions.json?v=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('editions.json を取得できません: ' + res.getResponseCode());
  const data = JSON.parse(res.getContentText('UTF-8'));
  if (!data.editions || !data.editions.length) throw new Error('号がありません');
  return data.editions[0];
}

function buildMail_(ed, adminEmail) {
  const news = ed.news || [];
  const col = ed.column || {};
  const top = news[0] ? news[0].title : '';
  const subject = '【中国ガスタービン・ウォッチ】' + ed.date.replace(/-/g, '/') + '号｜' + top;

  const newsHtml = news.map(function (n) {
    return '<li style="margin:0 0 14px"><b>' + esc_(n.title) + '</b><br>' +
      '<span style="color:#64748b;font-size:12px">' + esc_(n.cat) + '・' + esc_(n.date) + '・' + esc_(n.source) + '</span><br>' +
      '<span style="font-size:14px;color:#334155">' + esc_(n.summary) + '</span> ' +
      (n.url ? '<a href="' + esc_(n.url) + '" style="font-size:12px">出典</a>' : '') + '</li>';
  }).join('');

  const html =
    '<div style="font-family:sans-serif;max-width:640px;margin:auto;color:#0f172a;line-height:1.8">' +
    '<h2 style="margin:0 0 4px">中国ガスタービン・ウォッチ</h2>' +
    '<div style="color:#64748b;font-size:13px;margin-bottom:16px">' + esc_(ed.date) + '号　対象期間 ' + esc_(ed.period || '') + '</div>' +
    '<h3>今週のまとめ</h3><p style="font-size:14px">' + esc_(ed.summary) + '</p>' +
    (col.title ? '<h3>今週のコラム</h3><p><b>' + esc_(col.title) + '</b><br><span style="font-size:14px">' + esc_(col.lead || '') + '</span></p>' : '') +
    '<h3>ニュース</h3><ol style="padding-left:20px">' + newsHtml + '</ol>' +
    '<p><a href="' + SITE + '" style="font-weight:bold">サイトで全文（コラム本文）を読む</a></p>' +
    '<hr style="border:0;border-top:1px solid #e2e8f0">' +
    '<p style="font-size:12px;color:#64748b">要約とコラムはAIが自動作成したものです。使う前に出典で一次情報をご確認ください。<br>' +
    '配信停止をご希望の場合は、<a href="mailto:' + esc_(adminEmail) + '?subject=' + encodeURIComponent('配信停止') + '">こちら</a>から、または、このメールへの返信でお知らせください。</p>' +
    '</div>';

  const text = ed.date + '号\n' + ed.summary + '\n\n' + SITE +
    '\n\n配信停止をご希望の場合は、このメールに返信してください。';
  return { subject: subject, html: html, text: text };
}

function getRecipients_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const rows = sheet.getDataRange().getValues().slice(1);
  const seen = {};
  const list = [];
  rows.forEach(function (r) {
    const mail = String(r[0] || '').trim();
    const status = String(r[1] || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return;
    if (status === '停止') return;
    if (seen[mail.toLowerCase()]) return;
    seen[mail.toLowerCase()] = true;
    list.push(mail);
  });
  return list;
}

/** 毎朝の自動配信。同じ号は二重送信しない。 */
function sendLatest() {
  const ed = fetchLatest_();
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('lastSent') === ed.date) return;   // 送信済み
  const admin = Session.getEffectiveUser().getEmail();
  const mail = buildMail_(ed, admin);
  let ok = 0;
  getRecipients_().forEach(function (to) {
    try {
      GmailApp.sendEmail(to, mail.subject, mail.text, { htmlBody: mail.html, name: '中国ガスタービン・ウォッチ' });
      ok++;
    } catch (e) {
      Logger.log('送信失敗: ' + to + ' ' + e);
    }
  });
  props.setProperty('lastSent', ed.date);
  Logger.log(ed.date + ' 号を ' + ok + ' 件に送信しました');
}

/** 自分宛てだけにテスト送信する（登録者には送らない）。 */
function sendTest() {
  const admin = Session.getEffectiveUser().getEmail();
  const mail = buildMail_(fetchLatest_(), admin);
  GmailApp.sendEmail(admin, '[テスト] ' + mail.subject, mail.text, { htmlBody: mail.html, name: '中国ガスタービン・ウォッチ' });
}

/** 一度だけ実行：毎朝8時（中国時間）に sendLatest を動かす。 */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sendLatest').timeBased().everyDays(1).atHour(8).inTimezone('Asia/Shanghai').create();
}
