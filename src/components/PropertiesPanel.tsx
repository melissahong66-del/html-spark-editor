import { useState } from 'react'
import type { PropertyValues } from '../types/editor'

const STANDARD_COLORS = [
  '#000000', '#ffffff', '#e53935', '#fb8c00', '#fdd835',
  '#43a047', '#00acc1', '#1e88e5', '#8e24aa', '#757575',
]
const RECENT_COLORS_KEY = 'html-editor-recent-colors'

function loadRecentColors(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_COLORS_KEY) ?? '[]')
    return Array.isArray(stored) ? stored.filter((color): color is string => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 5) : []
  } catch {
    return []
  }
}

interface Props {
  values: PropertyValues | null
  lockAspect: boolean
  selectedTextCount: number
  onLockAspect: (value: boolean) => void
  onChange: (name: keyof PropertyValues, value: string) => void
  onTransformCase: (mode: 'upper' | 'lower') => void
  onToggleNumberedList: () => void
  onToggleBulletList: () => void
  onCommit: () => void
}

function Field({ label, name, value, onChange, onCommit, type = 'text', min, max, step, disabled }: {
  label: string; name: keyof PropertyValues; value: string | number; onChange: Props['onChange']; onCommit: () => void;
  type?: string; min?: number; max?: number; step?: number; disabled?: boolean
}) {
  return <label className="property-field"><span>{label}</span><input disabled={disabled} type={type} min={min} max={max} step={step} value={value} onChange={(event) => onChange(name, event.target.value)} onBlur={onCommit} /></label>
}

function ColorField({ label, name, value, recentColors, onChange, onCommit, onRemember, fallback = '#000000' }: {
  label: string
  name: keyof PropertyValues
  value: string
  recentColors: string[]
  onChange: Props['onChange']
  onCommit: () => void
  onRemember: (color: string) => void
  fallback?: string
}) {
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  const color = /^#[0-9a-f]{6}$/i.test(value) ? value : rgb
    ? `#${rgb.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`
    : fallback
  const palette = [...recentColors, ...STANDARD_COLORS.filter((standard) => !recentColors.includes(standard))]
  const chooseColor = (nextColor: string) => {
    onChange(name, nextColor)
    onRemember(nextColor)
    onCommit()
  }
  return <div className="color-control">
    <label className="property-field color-field compact-color"><span>{label}</span><input
      type="color"
      value={color}
      onInput={(event) => onChange(name, event.currentTarget.value)}
      onChange={(event) => { onChange(name, event.currentTarget.value); onRemember(event.currentTarget.value); onCommit() }}
      onBlur={onCommit}
    /></label>
    <div className="color-palette" aria-label={`${label}常用颜色`}>
      {palette.map((paletteColor, index) => <button
        key={paletteColor}
        className={index < recentColors.length ? 'color-swatch recent' : 'color-swatch'}
        style={{ backgroundColor: paletteColor }}
        title={`${index < recentColors.length ? '最近使用 ' : ''}${paletteColor}`}
        aria-label={`${label} ${paletteColor}`}
        onClick={() => chooseColor(paletteColor)}
      />)}
    </div>
  </div>
}

export function PropertiesPanel({ values, lockAspect, selectedTextCount, onLockAspect, onChange, onTransformCase, onToggleNumberedList, onToggleBulletList, onCommit }: Props) {
  const [boxOpen, setBoxOpen] = useState(true)
  const [recentColors, setRecentColors] = useState(loadRecentColors)
  const rememberColor = (color: string) => {
    const normalized = color.toLowerCase()
    setRecentColors((current) => {
      const next = [normalized, ...current.filter((item) => item !== normalized)].slice(0, 5)
      try { window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next)) } catch { /* storage can be disabled */ }
      return next
    })
  }
  if (!values) return <aside className="right-panel panel"><div className="panel-title">常用格式</div><div className="empty-note properties-empty">选择文字或文本框后进行编辑</div></aside>
  const fontOptions = [
    'inherit', 'Microsoft YaHei', 'PingFang SC', 'SimHei', 'SimSun', 'KaiTi', 'FangSong',
    'Arial', 'Helvetica', 'Verdana', 'Trebuchet MS', 'Tahoma', 'Georgia', 'Times New Roman',
    'Courier New', 'Impact', 'monospace',
  ]
  const normalizedFont = fontOptions.find((font) => values.fontFamily.replace(/["']/g, '').toLowerCase().includes(font.toLowerCase())) ?? values.fontFamily
  const setAndCommit = (name: keyof PropertyValues, value: string) => { onChange(name, value); onCommit() }
  return <aside className="right-panel panel properties-panel">
    <div className="panel-title panel-title-with-status"><span>常用格式</span><small>{selectedTextCount > 0 ? `已选择 ${selectedTextCount} 个字` : '已选中文本框'}</small></div>
    <section><h3>文字</h3>
      <label className="property-field"><span>字体</span><select value={normalizedFont} onChange={(event) => setAndCommit('fontFamily', event.target.value)}>
        {!fontOptions.includes(normalizedFont) && <option value={normalizedFont}>{normalizedFont}</option>}
        <option value="inherit">继承原字体</option>
        <option value="Arial">Arial</option>
        <option value="Microsoft YaHei">微软雅黑</option>
        <option value="PingFang SC">苹方</option>
        <option value="SimHei">黑体</option>
        <option value="SimSun">宋体</option>
        <option value="KaiTi">楷体</option>
        <option value="FangSong">仿宋</option>
        <option value="Helvetica">Helvetica</option>
        <option value="Verdana">Verdana</option>
        <option value="Trebuchet MS">Trebuchet MS</option>
        <option value="Tahoma">Tahoma</option>
        <option value="Georgia">Georgia</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Courier New">Courier New</option>
        <option value="Impact">Impact</option>
        <option value="monospace">等宽字体</option>
      </select></label>
      <label className="property-field font-size-field"><span>字号</span><span className="size-stepper">
        <button onClick={() => setAndCommit('fontSize', `${Math.max(1, (Number.parseFloat(values.fontSize) || 16) - 1)}`)} aria-label="减小字号">−</button>
        <input type="number" min={1} value={Number.parseFloat(values.fontSize) || 16} onChange={(event) => onChange('fontSize', event.target.value)} onBlur={onCommit} />
        <button onClick={() => setAndCommit('fontSize', `${(Number.parseFloat(values.fontSize) || 16) + 1}`)} aria-label="增大字号">＋</button>
      </span></label>
      <div className="text-style-buttons" aria-label="文字样式">
        <button className={Number.parseInt(values.fontWeight, 10) >= 600 || values.fontWeight === 'bold' ? 'active' : ''} onClick={() => setAndCommit('fontWeight', Number.parseInt(values.fontWeight, 10) >= 600 || values.fontWeight === 'bold' ? '400' : '700')} title="粗体"><strong>B</strong></button>
        <button className={values.fontStyle === 'italic' ? 'active' : ''} onClick={() => setAndCommit('fontStyle', values.fontStyle === 'italic' ? 'normal' : 'italic')} title="斜体"><em>I</em></button>
        <button className={values.textDecoration.includes('underline') ? 'active' : ''} onClick={() => setAndCommit('textDecoration', values.textDecoration.includes('underline') ? 'none' : 'underline')} title="下划线"><u>U</u></button>
      </div>
      <div className="property-field"><span>大小写</span><span className="case-buttons">
        <button onClick={() => onTransformCase('upper')} title="转换为英文大写">大写</button>
        <button onClick={() => onTransformCase('lower')} title="转换为英文小写">小写</button>
      </span></div>
      <div className="property-field"><span>列表</span><div className="list-buttons"><button className="numbered-list-button" onClick={onToggleNumberedList} title="转换为自动编号列表">1. 编号</button><button className="numbered-list-button" onClick={onToggleBulletList} title="转换为项目符号列表">• 项目符号</button></div></div>
      <div className="property-field"><span>对齐</span><span className="align-buttons">
        {([['left', '左'], ['center', '中'], ['right', '右'], ['justify', '齐']] as const).map(([value, label]) => <button key={value} className={values.textAlign === value || (value === 'left' && values.textAlign === 'start') ? 'active' : ''} onClick={() => setAndCommit('textAlign', value)}>{label}</button>)}
      </span></div>
      <ColorField label="字体颜色" name="color" value={values.color} recentColors={recentColors} onChange={onChange} onRemember={rememberColor} onCommit={onCommit} />
      <ColorField label="文字背景" name="backgroundColor" value={values.backgroundColor} recentColors={recentColors} fallback="#ffff00" onChange={onChange} onRemember={rememberColor} onCommit={onCommit} />
      <p className="panel-tip">单击选中文本框；双击进入文字编辑，再拖选几个字，可以只修改这些字的格式。</p>
    </section>
    <section className="collapsible-section">
      <button className="section-toggle" onClick={() => setBoxOpen((value) => !value)}><span>文本框位置与大小</span><span>{boxOpen ? '▴' : '▾'}</span></button>
      {boxOpen && <div className="collapsible-content"><div className="field-grid">
        <Field label="X" name="x" type="number" value={Math.round(values.x)} onChange={onChange} onCommit={onCommit} />
        <Field label="Y" name="y" type="number" value={Math.round(values.y)} onChange={onChange} onCommit={onCommit} />
        <Field label="宽" name="width" type="number" min={20} value={Math.round(values.width)} onChange={onChange} onCommit={onCommit} />
        <Field label="高" name="height" type="number" min={20} value={Math.round(values.height)} onChange={onChange} onCommit={onCommit} />
      </div><label className="checkbox-field"><input type="checkbox" checked={lockAspect} onChange={(event) => onLockAspect(event.target.checked)} />锁定宽高比</label></div>}
    </section>
  </aside>
}
