# 中国ガスタービン・ウォッチ｜China Gas Turbine Watch

中国ガスタービン業界の直近1週間のニュースを毎朝要約し、一週間の記事をまとめた週間コラムを掲載する静的サイトです（GitHub Pages）。

- `index.html` … サイト本体。`editions.json` を読み込んで表示します
- `editions.json` … 各号のデータ（新しい順）
- `feed.xml` … RSSフィード（最新30号）
- `scripts/add_edition.py` … 新しい号を追加し、`feed.xml` を再生成するスクリプト

```
python3 scripts/add_edition.py new_edition.json
```

記事の著作権は各出典に帰属します。掲載している要約と投稿案はClaudeが作成した下書きです。
