// 把 adaptedStyles 的页面级 SCSS 单独编译为按页注入的 CSS 文件，
// 避免把所有页面样式都打进 content script 的 style.css。
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import * as sass from 'sass'

const target = process.env.FIREFOX === 'true'
  ? 'extension-firefox'
  : process.env.SAFARI === 'true'
    ? 'extension-safari'
    : 'extension'

const SRC = join('src', 'styles', 'adaptedStyles')
const OUT = join(target, 'dist', 'styles', 'pages')

const pageFiles = readdirSync(join(SRC, 'pages'))
  // 下划线开头的是被 @use 的共享片段，本身不参与注入
  .filter(file => file.endsWith('.scss') && !file.startsWith('_'))
  .map(file => [
    file,
    join(SRC, 'pages', file),
  ])

const extraFiles = ['forceDark.scss'].map(file => [
  file,
  join(SRC, file),
])

mkdirSync(OUT, { recursive: true })

let total = 0
for (const [file, path] of [
  ...pageFiles,
  ...extraFiles,
]) {
  const result = sass.compile(path, { style: 'compressed' })
  const outFile = file.replace(/\.scss$/, '.css')
  writeFileSync(join(OUT, outFile), result.css)
  total += result.css.length
  console.log(`pages/${outFile}  ${(result.css.length / 1024).toFixed(1)} KB`)
}

console.log(`pages styles total ${(total / 1024).toFixed(1)} KB -> ${OUT}`)
