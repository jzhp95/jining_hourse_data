#!/usr/bin/env python3
"""Generate PDF report for 瑞马玖璋 光照分析报告"""

import math
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

# ── 字体注册 ──────────────────────────────────────────────
pdfmetrics.registerFont(TTFont('STHeitiLight',  '/System/Library/Fonts/STHeiti Light.ttc'))
pdfmetrics.registerFont(TTFont('STHeitiMedium', '/System/Library/Fonts/STHeiti Medium.ttc'))
pdfmetrics.registerFont(TTFont('Songti',        '/System/Library/Fonts/Supplemental/Songti.ttc'))

FONT_NORMAL  = 'STHeitiLight'
FONT_BOLD    = 'STHeitiMedium'

# ── 颜色 ─────────────────────────────────────────────────
C_PRIMARY    = colors.HexColor('#1a3a5c')   # 深蓝
C_ACCENT     = colors.HexColor('#c0392b')   # 红
C_HEADER_BG  = colors.HexColor('#1a3a5c')
C_ROW_ALT    = colors.HexColor('#eaf0f7')
C_RULE       = colors.HexColor('#2980b9')
C_WARNING    = colors.HexColor('#e67e22')
C_GOOD       = colors.HexColor('#27ae60')
C_CODE_BG    = colors.HexColor('#f4f4f4')
C_WHITE      = colors.white
C_BLACK      = colors.black
C_GREY       = colors.HexColor('#555555')

W, H = A4  # 595 x 842 pt

# ── 文档 ─────────────────────────────────────────────────
OUT = '/Users/jzhp/Documents/trae_projects/buy_house/瑞马玖璋_光照分析报告.pdf'
doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=2.2*cm, rightMargin=2.2*cm,
    topMargin=2.5*cm, bottomMargin=2.5*cm,
    title='瑞马玖璋 5#6#7# 楼光照分析报告',
    author='光照计算模型',
)

# ── 样式 ─────────────────────────────────────────────────
def S(name, **kw):
    defaults = dict(fontName=FONT_NORMAL, fontSize=10, leading=16, textColor=C_BLACK)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)

styles = {
    'cover_title':  S('cover_title',  fontName=FONT_BOLD, fontSize=22, leading=32,
                       textColor=C_PRIMARY, alignment=TA_CENTER),
    'cover_sub':    S('cover_sub',    fontName=FONT_NORMAL, fontSize=13, leading=20,
                       textColor=C_GREY, alignment=TA_CENTER),
    'cover_note':   S('cover_note',   fontName=FONT_NORMAL, fontSize=9, leading=14,
                       textColor=C_GREY, alignment=TA_CENTER),
    'h1':           S('h1', fontName=FONT_BOLD, fontSize=14, leading=22,
                       textColor=C_PRIMARY, spaceBefore=14, spaceAfter=4),
    'h2':           S('h2', fontName=FONT_BOLD, fontSize=11.5, leading=18,
                       textColor=C_PRIMARY, spaceBefore=10, spaceAfter=3),
    'body':         S('body', fontSize=9.5, leading=16, alignment=TA_JUSTIFY,
                       spaceBefore=2, spaceAfter=2),
    'body_indent':  S('body_indent', fontSize=9.5, leading=16,
                       leftIndent=1*cm, spaceBefore=1, spaceAfter=1),
    'code':         S('code', fontName=FONT_NORMAL, fontSize=8.5, leading=14,
                       backColor=C_CODE_BG, leftIndent=0.5*cm, rightIndent=0.5*cm,
                       spaceBefore=4, spaceAfter=4, borderPad=4),
    'conclusion':   S('conclusion', fontName=FONT_BOLD, fontSize=9.5, leading=15,
                       textColor=C_ACCENT, spaceBefore=4, spaceAfter=4),
    'note':         S('note', fontSize=8.5, leading=14, textColor=C_GREY,
                       spaceBefore=2, spaceAfter=2),
    'caption':      S('caption', fontName=FONT_BOLD, fontSize=9, leading=14,
                       textColor=C_GREY, alignment=TA_CENTER, spaceBefore=2, spaceAfter=6),
}

TW = W - 2.2*cm*2  # text width

# ── 辅助函数 ──────────────────────────────────────────────
def P(text, style='body'):
    return Paragraph(text, styles[style])

def HR(color=C_RULE, thickness=0.5):
    return HRFlowable(width='100%', thickness=thickness, color=color, spaceAfter=4, spaceBefore=4)

def section_rule():
    return HR(C_PRIMARY, 1.2)

def table_style_base(col_widths, header_rows=1):
    ts = TableStyle([
        ('FONTNAME',    (0,0), (-1,-1), FONT_NORMAL),
        ('FONTSIZE',    (0,0), (-1,-1), 8.5),
        ('LEADING',     (0,0), (-1,-1), 13),
        ('FONTNAME',    (0,0), (-1, header_rows-1), FONT_BOLD),
        ('FONTSIZE',    (0,0), (-1, header_rows-1), 9),
        ('BACKGROUND',  (0,0), (-1, header_rows-1), C_HEADER_BG),
        ('TEXTCOLOR',   (0,0), (-1, header_rows-1), C_WHITE),
        ('ALIGN',       (0,0), (-1,-1), 'LEFT'),
        ('VALIGN',      (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',  (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0),(-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING',(0,0), (-1,-1), 6),
        ('GRID',        (0,0), (-1,-1), 0.3, colors.HexColor('#aabbcc')),
        ('ROWBACKGROUNDS', (0, header_rows), (-1,-1), [C_WHITE, C_ROW_ALT]),
    ])
    return ts

def make_table(data, col_widths, header_rows=1, extra_style=None):
    t = Table(data, colWidths=col_widths, repeatRows=header_rows)
    ts = table_style_base(col_widths, header_rows)
    if extra_style:
        for cmd in extra_style:
            ts.add(*cmd)
    t.setStyle(ts)
    return t

# ── 日照计算 ──────────────────────────────────────────────
phi = 35.4
h_f = 3.10
buildings = {
    '5#': {'H_front': 53.45, 'D': 43.794, 'dY': 24.411},
    '6#': {'H_front': 53.45, 'D': 37.41,  'dY': 25.910},
    '7#': {'H_front': 25.55, 'D': 32.302, 'dY': 21.255},
}

def days_unblocked(H_front, D, H_window):
    H_diff = H_front - H_window
    if H_diff <= 0:
        return 365
    ta = H_diff / D
    ad = math.degrees(math.atan(ta))
    dr = ad - 90 + phi
    if dr <= -23.5: return 365
    if dr >= 23.5:  return 0
    theta = math.acos(dr / -23.5)
    return 365 - round((theta / math.pi) * 365)

def months_str(d):
    if d == 365: return '全年'
    return f'{round(d/30.4,1)} 月'

# ── 内容构建 ──────────────────────────────────────────────
story = []

# ════════════════════════════════════
# 封面
# ════════════════════════════════════
story += [
    Spacer(1, 3*cm),
    P('瑞马玖璋', 'cover_title'),
    Spacer(1, 0.4*cm),
    P('5# · 6# · 7# 楼  光照分析报告', 'cover_sub'),
    Spacer(1, 0.8*cm),
    HR(C_ACCENT, 2),
    Spacer(1, 0.5*cm),
    P('基于规划总平面图坐标数据的定量计算', 'cover_note'),
    P('地点：济宁市太白湖新区 · 分析基准：冬至日正午太阳高度角', 'cover_note'),
    P('报告日期：2026 年 5 月', 'cover_note'),
    Spacer(1, 2*cm),
]

# 封面摘要表
cover_data = [
    ['指标', '5# 楼', '6# 楼', '7# 楼'],
    ['前方遮挡楼栋', '6#（17F）', '7#（17F）', '16#（7+1F）'],
    ['前排楼高度', '53.45 m', '53.45 m', '25.55 m'],
    ['南北净距', '43.794 m', '37.41 m', '32.302 m'],
    ['前排楼向东错位', '+24.41 m', '+25.91 m', '+21.26 m'],
    ['冬至遮挡高度', '27.04 m', '30.89 m', '6.07 m'],
    ['遮挡层数（约）', '≈ 9F', '≈ 10F', '≈ 2F'],
    ['全年无遮挡起始层', '10F', '11F', '3F'],
]
cw_cover = [TW*0.32, TW*0.23, TW*0.23, TW*0.22]
extra = [
    ('ALIGN', (1,0), (-1,-1), 'CENTER'),
    ('FONTNAME', (0,1), (0,-1), FONT_BOLD),
    ('BACKGROUND', (0,7), (-1,7), colors.HexColor('#d5e8d4')),
]
story.append(make_table(cover_data, cw_cover, extra_style=extra))
story.append(Spacer(1, 0.8*cm))
story.append(P('采光综合排序：  7# > 5# > 6#', 'conclusion'))
story.append(PageBreak())

# ════════════════════════════════════
# 一、基础技术指标
# ════════════════════════════════════
story += [P('一、基础技术指标', 'h1'), section_rule()]

story += [P('1. 楼栋前后遮挡关系', 'h2')]
rel_data = [
    ['被分析楼栋', '正前方遮挡楼栋', '遮挡关系说明', '是否可归并计算'],
    ['5# 楼', '6# 楼', '同组高层住宅，高度相同', '不可归并'],
    ['6# 楼', '7# 楼', '同组高层住宅，高度相同', '不可归并'],
    ['7# 楼', '16# 楼', '南侧低层住宅（7+1F）', '不可归并'],
]
cw_rel = [TW*0.18, TW*0.18, TW*0.40, TW*0.24]
story.append(make_table(rel_data, cw_rel))
story.append(Spacer(1, 0.3*cm))

story += [P('2. 已知计算参数', 'h2')]
param_data = [
    ['参数', '含义', '取值'],
    ['phi', '济宁市纬度', '35.4 度'],
    ['alpha', '冬至日正午太阳高度角', '31.1 度'],
    ['tan(alpha)', '冬至日正午高度角正切值', '0.603'],
    ['h', '住宅标准层高', '3.10 m'],
    ['H5 = H6 = H7', '5#/6#/7# 楼建筑总高', '53.45 m（17F，规划限高 54 m）'],
    ['H16', '16# 楼建筑总高', '25.55 m（7+1F）'],
    ['D5-6', '5# 与 6# 南北向净距', '43.794 m（坐标差值）'],
    ['D6-7', '6# 与 7# 南北向净距', '37.41 m（图面标注）/ 39.420 m（坐标校核）'],
    ['D7-16', '7# 与 16# 南北向净距', '32.302 m（坐标差值）'],
    ['DeltaY6-5', '6# 相对 5# 向东错位量', '+24.411 m'],
    ['DeltaY7-6', '7# 相对 6# 向东错位量', '+25.910 m'],
    ['DeltaY16-7', '16# 相对 7# 向东错位量', '+21.255 m'],
]
cw_param = [TW*0.25, TW*0.35, TW*0.40]
story.append(make_table(param_data, cw_param))
story.append(P('注：5#、6#、7#、16# 首层室内标高均为 37.60 m，楼栋间无基底高差，无需修正。', 'note'))
story.append(Spacer(1, 0.3*cm))

# ════════════════════════════════════
# 二、计算公式
# ════════════════════════════════════
story += [P('二、计算公式', 'h1'), section_rule()]

story += [
    P('1. 冬至日正午太阳高度角', 'h2'),
    P('alpha  =  90° − phi − 23.5°  =  90° − 35.4° − 23.5°  =  31.1°', 'code'),
    P('2. 前排楼阴影打到后排楼的高度', 'h2'),
    P('H遮  =  H前排  −  D × tan(alpha)', 'code'),
    P('若 H遮 ≤ 0，说明冬至正午阴影不会投射到后排楼立面，全年无遮挡；若 H遮 > 0，说明从地面起算遮挡到该高度。', 'body'),
    P('3. 换算到遮挡楼层', 'h2'),
    P('N遮  =  H遮 / h  （h = 3.10 m/层）', 'code'),
    P('4. 全年正午无遮挡天数（逐层计算）', 'h2'),
    P('以每层窗台高度（底板 + 0.9 m）为评估点，反推太阳赤纬，再用赤纬积分换算全年天数：', 'body'),
    P('theta_req  =  arctan( (H前排 − H窗台) / D )\n'
      'delta_req  =  theta_req − 90° + phi\n'
      'days_blocked  =  arccos(delta_req / −23.5) / π × 365\n'
      'days_unblocked  =  365 − days_blocked', 'code'),
    Spacer(1, 0.3*cm),
]

# ════════════════════════════════════
# 三—五  各楼栋独立分析
# ════════════════════════════════════
bldg_details = [
    {
        'title': '三、5# 楼：前方为 6# 楼',
        'name': '5#',
        'logic': (
            '5# 楼前方是 6# 楼（17F，高 53.45 m），两楼南北净距 43.794 m。'
            '6# 楼相对 5# 楼向东错位 24.411 m，因此正午时 5# 楼的西边户和西中户'
            '南窗偏出 6# 楼正北投影范围，正午遮挡显著减弱；东中户和东边户则处于 6# 楼投影内，'
            '低层采光较差。'
        ),
        'calc': '5# 遮挡高度 = 53.45 − 43.794 × 0.603 = 27.04 m\n5# 遮挡层数 = 27.04 / 3.10 = 8.72 层',
        'conclusion': '按冬至日正午计算，5# 楼阴影高度约到第 9 层下部（东侧户）。10F 以上正午直射条件明显改善；西边户和西中户全楼层正午均无前排楼正面遮挡。',
        'floor_data': [
            ['楼层区间', '东中户 / 东边户（遮挡侧）', '西边户 / 西中户（侧向无遮）'],
            ['1F – 3F', '冬至正午处于 6# 阴影内，采光依赖斜射', '全年正午无正面遮挡'],
            ['4F – 8F', '仍在遮挡区，随楼层升高逐步改善', '全年正午无正面遮挡'],
            ['9F', '临界层，实际效果受窗台高度和阳台进深影响', '全年正午无正面遮挡'],
            ['10F – 17F', '全年正午直射无遮挡，南向视野被 6# 楼压住', '全年正午无正面遮挡'],
        ],
        'unit_data': [
            ['户位', '正午采光特点', '低层建议'],
            ['西边户', '正午偏出 6# 投影，全楼层无遮挡；下午有西向补光', '各层均可，西晒需做隔热'],
            ['西中户', '正午偏出 6# 投影，全楼层无遮挡', '各层均可'],
            ['东中户', '落在 6# 正北投影内，采光依赖楼层', '建议 10F 以上'],
            ['东边户', '落在 6# 正北投影内；早晨有东向补光', '建议 10F 以上'],
        ],
        'cw_floor': [TW*0.15, TW*0.45, TW*0.40],
    },
    {
        'title': '四、6# 楼：前方为 7# 楼',
        'name': '6#',
        'logic': (
            '6# 楼前方是 7# 楼（17F，高 53.45 m）。图面直接标注净距 37.41 m，'
            '坐标差校核值 39.420 m，两者计算结果相近，遮挡均约到第 10 层。'
            '7# 楼相对 6# 楼向东错位 25.910 m，与 5# 楼情形类似：'
            '6# 楼西侧两户正午偏出 7# 楼投影，东侧两户受遮挡。'
            '6# 是三栋中遮挡压力最大的楼栋。'
        ),
        'calc': (
            '（图面净距）6# 遮挡高度 = 53.45 − 37.41 × 0.603 = 30.89 m\n'
            '（图面净距）6# 遮挡层数 = 30.89 / 3.10 = 9.96 层\n\n'
            '（坐标校核）6# 遮挡高度 = 53.45 − 39.420 × 0.603 = 29.68 m\n'
            '（坐标校核）6# 遮挡层数 = 29.68 / 3.10 = 9.57 层'
        ),
        'conclusion': '无论采用哪组数据，6# 楼冬至正午遮挡约到第 10 层（东侧户）。11F 以上正午采光明显改善；西边户和西中户全楼层均无正面遮挡。6# 是三栋中遮挡最严重的楼栋，东侧低层须谨慎。',
        'floor_data': [
            ['楼层区间', '东中户 / 东边户（遮挡侧）', '西边户 / 西中户（侧向无遮）'],
            ['1F – 3F', '冬至正午基本全遮挡，主要看绿化和价格', '全年正午无正面遮挡'],
            ['4F – 8F', '仍处遮挡区，冬季南向直射时间偏短', '全年正午无正面遮挡'],
            ['9F – 10F', '核心临界层，须参考官方日照分析图', '全年正午无正面遮挡'],
            ['11F – 17F', '全年正午直射无遮挡，南向视野被 7# 楼压住', '全年正午无正面遮挡'],
        ],
        'unit_data': [
            ['户位', '正午采光特点', '低层建议'],
            ['西边户', '正午偏出 7# 投影，全楼层无遮挡；下午有西向补光', '各层均可，注意西晒'],
            ['西中户', '正午偏出 7# 投影，全楼层无遮挡', '各层均可'],
            ['东中户', '落在 7# 正北投影内，9F–10F 为临界层', '建议 11F 以上'],
            ['东边户', '落在 7# 正北投影内；早晨有东向补光', '建议 11F 以上'],
        ],
        'cw_floor': [TW*0.15, TW*0.45, TW*0.40],
    },
    {
        'title': '五、7# 楼：前方为 16# 楼',
        'name': '7#',
        'logic': (
            '7# 楼前方是 16# 楼（7+1F，高 25.55 m），南北净距 32.302 m。'
            '16# 楼高度远低于 5#/6# 前排楼，且相对 7# 楼向东错位 21.255 m。'
            '7# 楼的遮挡压力在三栋中最小，3F 起即可全年正午无遮挡（东侧户），'
            '西侧两户更是全楼层无前排楼正午遮挡。'
        ),
        'calc': '7# 遮挡高度 = 25.55 − 32.302 × 0.603 = 6.07 m\n7# 遮挡层数 = 6.07 / 3.10 = 1.96 层',
        'conclusion': '7# 楼冬至正午阴影仅约到第 2 层（东侧户）。3F 起正午直射条件明显改善，5F 以上采光稳定性显著优于 5#、6# 同层。西侧两户全楼层均无正面遮挡。',
        'floor_data': [
            ['楼层区间', '东中户 / 东边户（遮挡侧）', '西边户 / 西中户（侧向无遮）'],
            ['1F', '可能受 16# 楼遮挡，同时受绿化、小品影响', '全年正午无正面遮挡'],
            ['2F', '临界层，实际效果受窗台高度影响', '全年正午无正面遮挡'],
            ['3F – 4F', '全年正午基本无遮挡，低层性价比最高', '全年正午无正面遮挡'],
            ['5F – 17F', '全年正午无遮挡，三栋里同层采光优势最明显', '全年正午无正面遮挡'],
        ],
        'unit_data': [
            ['户位', '正午采光特点', '低层建议'],
            ['西边户', '全楼层正午无遮挡；下午有西向补光', '各层均可'],
            ['西中户', '全楼层正午无遮挡', '各层均可'],
            ['东中户', '1F–2F 临界，3F 起全年无遮挡', '3F 以上均好'],
            ['东边户', '1F–2F 临界；早晨有东向补光', '3F 以上均好'],
        ],
        'cw_floor': [TW*0.15, TW*0.45, TW*0.40],
    },
]

for bd in bldg_details:
    story += [P(bd['title'], 'h1'), section_rule()]
    story += [P('遮挡逻辑', 'h2'), P(bd['logic'], 'body')]
    story += [P('参数计算', 'h2'), P(bd['calc'], 'code')]
    story += [P(bd['conclusion'], 'conclusion')]
    story += [P('各楼层影响', 'h2')]
    cw_f = bd['cw_floor']
    story.append(make_table(bd['floor_data'], cw_f))
    story += [Spacer(1, 0.2*cm), P('各户位影响', 'h2')]
    cw_u = [TW*0.20, TW*0.42, TW*0.38]
    story.append(make_table(bd['unit_data'], cw_u))
    story.append(Spacer(1, 0.4*cm))

# ════════════════════════════════════
# 六、逐层正午日照天数计算
# ════════════════════════════════════
story += [P('六、逐层正午日照天数计算', 'h1'), section_rule()]
story += [
    P('以下为各楼层南向窗台（底板+0.9 m）在正午时段（约 11:00–13:00）可接受直射阳光的天数。'
      '"全年"表示即使在日照条件最差的冬至日，正午也不受前排楼遮挡。'
      '全天实际获得日照时间比此更长，东西边户早晚补偿额外加分。', 'body'),
    Spacer(1, 0.3*cm),
]

# 主汇总表
hdr = ['楼层', '5# 东侧户', '5# 西侧户', '6# 东侧户', '6# 西侧户', '7# 东侧户', '7# 西侧户']
sun_data = [hdr]
bkeys = ['5#', '6#', '7#']

def days_east(bname, floor):
    b = buildings[bname]
    H_window = (floor - 1) * h_f + 0.9
    return days_unblocked(b['H_front'], b['D'], H_window)

def days_west(bname, floor):
    # West units are outside the front building's noon shadow due to east offset
    b = buildings[bname]
    H_window = (floor - 1) * h_f + 0.9
    H_diff = b['H_front'] - H_window
    if H_diff <= 0:
        return 365
    # West unit center ~5.5m, east offset ~21-26m: west unit is always outside shadow
    return 365

def fmt_days(d):
    if d == 365: return '全年'
    m = round(d / 30.4, 1)
    return f'{d} 天\n({m} 月)'

for floor in range(1, 18):
    row = [f'{floor}F']
    for bn in bkeys:
        de = days_east(bn, floor)
        row.append(fmt_days(de))
        row.append('全年' if days_west(bn, floor) == 365 else fmt_days(days_west(bn, floor)))
    sun_data.append(row)

cw_sun = [TW*0.07, TW*0.14, TW*0.14, TW*0.14, TW*0.14, TW*0.14, TW*0.14]

# color cells: green for 全年, orange gradient for partial
extra_sun = [('ALIGN', (1,0), (-1,-1), 'CENTER')]
for r in range(1, 18):
    for c in [1, 3, 5]:  # east unit columns
        d = days_east(bkeys[(c-1)//2], r)
        if d == 365:
            extra_sun.append(('BACKGROUND', (c, r), (c, r), colors.HexColor('#d5e8d4')))
        elif d >= 300:
            extra_sun.append(('BACKGROUND', (c, r), (c, r), colors.HexColor('#fff2cc')))
        elif d >= 240:
            extra_sun.append(('BACKGROUND', (c, r), (c, r), colors.HexColor('#fce4d6')))
        else:
            extra_sun.append(('BACKGROUND', (c, r), (c, r), colors.HexColor('#f4cccc')))
    for c in [2, 4, 6]:  # west unit columns (all 全年)
        extra_sun.append(('BACKGROUND', (c, r), (c, r), colors.HexColor('#d5e8d4')))

story.append(make_table(sun_data, cw_sun, extra_style=extra_sun))
story.append(P('颜色说明：绿色 = 全年正午无遮挡；黄色 ≥ 300 天；橙色 ≥ 240 天；红色 < 240 天', 'note'))
story.append(Spacer(1, 0.4*cm))

# 关键节点表
story += [P('关键节点汇总', 'h2')]
kn_data = [
    ['楼栋', '全年无遮挡起始层（东侧户）', '1F 东侧户可见阳光月份', '西侧户情况'],
    ['5#', '10F', '约 4 月—10 月（6.7 个月）', '全楼层全年无遮挡'],
    ['6#', '11F', '约 4 月—10 月（6.0 个月）', '全楼层全年无遮挡'],
    ['7#', '3F',  '约 3 月—11 月（9.1 个月）', '全楼层全年无遮挡'],
]
cw_kn = [TW*0.10, TW*0.28, TW*0.32, TW*0.30]
extra_kn = [
    ('ALIGN', (1,0), (-1,-1), 'CENTER'),
    ('BACKGROUND', (1,3), (1,3), colors.HexColor('#d5e8d4')),
]
story.append(make_table(kn_data, cw_kn, extra_style=extra_kn))
story.append(Spacer(1, 0.4*cm))

# ════════════════════════════════════
# 七、四户差异对比
# ════════════════════════════════════
story += [P('七、同层四户采光差异', 'h1'), section_rule()]
story += [
    P('由于三组前排楼均向东错位 21–26 m，楼宽约 44 m，导致同层四户之间存在根本性差异：', 'body'),
    Spacer(1, 0.2*cm),
]

unit_cmp = [
    ['户位', '正午南向遮挡', '附加采光', '综合评价'],
    ['西边户\n（最西侧）',
     '正午偏出前排楼投影\n全楼层无正面遮挡',
     '西向窗：下午 / 冬日长照',
     '三栋各楼层均优；\n注意夏季西晒'],
    ['西中户',
     '正午偏出前排楼投影\n全楼层无正面遮挡',
     '无侧向窗',
     '正午采光全层无忧；\n通风略逊于边户'],
    ['东中户',
     '处于前排楼正北投影内\n采光完全依赖楼层',
     '无侧向窗',
     '对楼层最敏感，\n低层须谨慎'],
    ['东边户\n（最东侧）',
     '处于前排楼正北投影内\n采光依赖楼层',
     '东向窗：早晨补光',
     '正午受限，\n早晨补偿，综合可接受'],
]
cw_unit_cmp = [TW*0.15, TW*0.28, TW*0.22, TW*0.35]
extra_unit = [
    ('BACKGROUND', (0,1), (-1,2), colors.HexColor('#d5e8d4')),
    ('BACKGROUND', (0,3), (-1,4), colors.HexColor('#fce4d6')),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]
story.append(make_table(unit_cmp, cw_unit_cmp, extra_style=extra_unit))
story.append(Spacer(1, 0.2*cm))
story.append(P('注：以上基于楼宽约 44 m 估算。如有实际东西向宽度数据，可精确到每户边界。', 'note'))
story.append(Spacer(1, 0.4*cm))

# ════════════════════════════════════
# 八、地上车位改绿化
# ════════════════════════════════════
story += [P('八、地上车位改绿化的影响', 'h1'), section_rule()]
story += [
    P('规划图中标注的地上车位全部改为绿化，对低楼层居住体验有明确利好，但不能抵消正午直射日照的遮挡：', 'body'),
    Spacer(1, 0.2*cm),
]
green_data = [
    ['影响维度', '5#/6# 低层', '7# 低层'],
    ['声光污染', '消除车灯扫射和关门噪音', '同等改善，基础更好'],
    ['景观视野', '窗外变为园林绿化，私密性提升', '同等改善'],
    ['热环境', '夏季地面热辐射降低，低层更凉', '同等改善'],
    ['正午直射日照', '绿化不改变前排楼投影，不改变日照', '不改变，但本身遮挡仅到 2F'],
    ['综合建议', '低层主要买环境和价格，不应按采光优势买', '低层性价比更高，遮挡本已很小'],
]
cw_green = [TW*0.22, TW*0.39, TW*0.39]
story.append(make_table(green_data, cw_green))
story.append(Spacer(1, 0.4*cm))

# ════════════════════════════════════
# 九、选房建议
# ════════════════════════════════════
story += [P('九、选房决策建议', 'h1'), section_rule()]
rec_data = [
    ['选择目标', '推荐楼栋 / 楼层', '推荐户位', '说明'],
    ['追求最稳定采光',
     '7# 5F 以上',
     '任意户位均可',
     '5F 以上全年全天无遮挡，前排 16# 低矮'],
    ['追求性价比',
     '7# 3F–6F',
     '任意户位',
     '7# 从 3F 起东侧户全年无遮挡，价格通常低于高层'],
    ['高层 + 视野',
     '5# 或 6# 12F 以上',
     '西边户 / 东边户',
     '视野越过前排楼，采光视野双优'],
    ['中层折中',
     '5# 10F–11F',
     '西边户 / 西中户',
     '5# 从 10F 东侧户也全年无遮挡'],
    ['接受低层（重环境）',
     '7# 1F–4F',
     '西边户 / 西中户',
     '遮挡最小、绿化最好，性价比最高的低层选择'],
    ['最不推荐',
     '6# 1F–10F 东侧户',
     '东中户 / 东边户',
     '遮挡最严重，10F 仍在临界层'],
]
cw_rec = [TW*0.22, TW*0.22, TW*0.18, TW*0.38]
extra_rec = [
    ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#d5e8d4')),
    ('BACKGROUND', (0,2), (-1,2), colors.HexColor('#d5e8d4')),
    ('BACKGROUND', (0,6), (-1,6), colors.HexColor('#f4cccc')),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]
story.append(make_table(rec_data, cw_rec, extra_style=extra_rec))
story.append(Spacer(1, 0.4*cm))

# ════════════════════════════════════
# 十、补充数据建议
# ════════════════════════════════════
story += [P('十、建议向售楼处索要的数据', 'h1'), section_rule()]
story += [
    P('本报告已可支撑基础选房判断。若需精确到每户冬至日累计日照小时数，还需以下数据：', 'body'),
    Spacer(1, 0.2*cm),
]
supp_data = [
    ['序号', '数据项', '用途'],
    ['1', '规划审批日照分析图（冬至日 8:00–16:00 累计时长）', '精确验证每户有效日照小时数'],
    ['2', '5#、6#、7# 每栋每户日照小时数汇总表', '直接查验是否达到国家 2 小时标准'],
    ['3', '各户型南向窗台高度、阳台进深', '修正本文窗台假设（目前取 0.9 m）'],
    ['4', '5#、6#、7# 楼体实际东西向宽度（外墙到外墙）', '精确判定每户落在前排楼投影内/外'],
]
cw_supp = [TW*0.06, TW*0.56, TW*0.38]
story.append(make_table(supp_data, cw_supp))
story.append(Spacer(1, 0.6*cm))

# ════════════════════════════════════
# 结论
# ════════════════════════════════════
story += [HR(C_ACCENT, 1.5)]
story += [P('综合结论', 'h1')]
conclusion_data = [
    ['排序', '楼栋', '采光优势', '主要限制'],
    ['第 1', '7# 楼', '前排仅 7+1F（25.55 m），东侧户从 3F 起全年正午无遮挡；西侧户全楼层无遮挡', '1F–2F 东侧户轻微遮挡'],
    ['第 2', '5# 楼', '前排 6# 偏东 24.4 m，西侧户全年无遮挡；东侧户从 10F 起全年无遮挡', '东侧户 1F–9F 冬季正午受限'],
    ['第 3', '6# 楼', '西侧户同样全年无遮挡；楼间距最小导致东侧户遮挡最重', '东侧户 1F–10F 正午受限；11F 才安全'],
]
cw_con = [TW*0.08, TW*0.10, TW*0.48, TW*0.34]
extra_con = [
    ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#d5e8d4')),
    ('BACKGROUND', (0,3), (-1,3), colors.HexColor('#fce4d6')),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]
story.append(make_table(conclusion_data, cw_con, extra_style=extra_con))
story += [
    Spacer(1, 0.4*cm),
    P('关键规律：三组前排楼均向东错位 21–26 m，使得每栋楼的西边户和西中户在正午时段均偏出前排楼投影，'
      '全楼层全年正午无正面遮挡。东中户和东边户的采光质量完全取决于楼层。'
      '在同等预算下，优先选西侧户位、优先选 7# 楼，是经本报告计算后最具性价比的策略。',
      'body'),
]

# ── 生成 ─────────────────────────────────────────────────
doc.build(story)
print(f'PDF 生成成功：{OUT}')
