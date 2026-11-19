"""Static cascade/contrast regression checks against the actual stylesheet order.

Run: python -m pip install tinycss2 cssselect2 lxml
     python tests/school-theme-readability.py
This is not a browser layout or screenshot test. It checks the known problem
surfaces, CSS specificity, inherited custom properties, and sRGB contrast.
"""
import re
from pathlib import Path
import cssselect2
import tinycss2
from tinycss2.color3 import parse_color
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / 'school.html').read_text()
FILES = re.findall(r'<link rel="stylesheet" href="([^?]+)\?', PAGE)
assert FILES[-1] == 'school/theme-readability.css'


def declarations(text):
    return [d for d in tinycss2.parse_declaration_list(text, skip_comments=True,
            skip_whitespace=True) if d.type == 'declaration']


def rules(items):
    for rule in items:
        if rule.type == 'qualified-rule':
            yield rule
        elif rule.type == 'at-rule' and rule.lower_at_keyword == 'supports':
            yield from rules(tinycss2.parse_rule_list(rule.content))
        # Color fixes are independent of breakpoints. Media layout and browser
        # interaction (hover/focus) need the separate visual QA pass.


MATCHER = cssselect2.Matcher()
for file in FILES:
    sheet = tinycss2.parse_stylesheet((ROOT / file).read_text(), skip_comments=True,
                                    skip_whitespace=True)
    for rule in rules(sheet):
        selector = tinycss2.serialize(rule.prelude).strip()
        props = declarations(rule.content)
        try:
            selectors = cssselect2.compile_selector_list(selector)
        except cssselect2.SelectorError:
            assert file != FILES[-1], f'Invalid new selector: {selector}'
            continue
        for item in selectors:
            if not item.pseudo_element:
                MATCHER.add_selector(item, props)


def resolve(value, props):
    for _ in range(30):
        updated = re.sub(r'var\((--[\w-]+)(?:,([^()]*))?\)',
                         lambda m: props.get(m[1], m[2] or ''), value)
        if updated == value:
            return value
        value = updated
    raise AssertionError('Cyclic CSS custom property')


def computed(node, parent):
    result = {k: v for k, v in parent.items() if k.startswith('--') or k == 'color'}
    winning = {}
    for specificity, order, _, props in MATCHER.match(node):
        for prop in props:
            value = tinycss2.serialize(prop.value).strip()
            name = prop.lower_name
            expanded = {name: value}
            if name == 'background':
                # A shorthand resets previous background longhands.
                expanded = {'background-color': value, 'background-image': value}
            for key, val in expanded.items():
                rank = (prop.important, specificity, order)
                if key not in winning or rank >= winning[key][0]:
                    winning[key] = (rank, val)
    result.update({key: value for key, (_, value) in winning.items()})
    for key, value in list(result.items()):
        result[key] = resolve(value, result)
    return result


def rgba(value):
    value = value.strip()
    if value == 'none':
        value = 'transparent'
    if re.fullmatch(r'#[\da-fA-F]{4}|#[\da-fA-F]{8}', value):
        h = value[1:]
        if len(h) == 4:
            h = ''.join(c * 2 for c in h)
        return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4, 6))
    color = parse_color(value)
    return tuple(color) if color and color != 'currentColor' else None


def over(a, b):
    return tuple(a[i] * a[3] + b[i] * (1 - a[3]) for i in range(3)) + (1,)


def backgrounds(style, inherited):
    value = style.get('background-image', '')
    if 'gradient(' in value:
        colors = [rgba(c) for c in re.findall(r'#[\da-fA-F]{3,8}\b', value)]
    else:
        value = style.get('background-color', 'transparent')
        mixed = re.fullmatch(r'color-mix\(in srgb,\s*(#[\da-fA-F]+)\s+(\d+)%,\s*(#[\da-fA-F]+)\)', value)
        if mixed:
            a, b, weight = rgba(mixed[1]), rgba(mixed[3]), int(mixed[2]) / 100
            colors = [tuple(a[i] * weight + b[i] * (1 - weight) for i in range(4))]
        else:
            colors = [rgba(value)]
    colors = [c for c in colors if c]
    assert colors, f'Unhandled CSS background: {value}'
    return [over(c, base) for c in colors for base in inherited]


def contrast(a, b):
    def luminance(c):
        linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c[:3]]
        return sum(x * y for x, y in zip(linear, (.2126, .7152, .0722)))
    x, y = sorted((luminance(a), luminance(b)))
    return (y + .05) / (x + .05)


def modal(kind, content):
    return f'<dialog id="modal" class="{kind}" open><div class="modal-top"><h2 data-check="title">제목</h2><button id="modal-close" class="close-button" data-check="close">×</button></div><div id="modal-content">{content}</div></dialog>'


SETTINGS = '<label class="setting-row"><span><b data-check="setting label">다크 모드</b><small data-check="setting hint">화면 설정</small></span><input type="checkbox" id="setting-theme"></label><p class="settings-note" data-check="settings note">저장됩니다.</p><button class="secondary" data-check="settings button">도움말</button>'
CASES = {
    'rank tabs': modal('', '<div class="ranking-tabs"><button class="secondary active" data-check="active rank">단장</button><button class="secondary" data-check="inactive rank">뫼비우스</button></div>'),
    'gear controls': modal('equipment-modal', '<div class="gear-filters"><button aria-pressed="true" data-check="selected">무기</button><button aria-pressed="false" data-check="unselected">방어구</button></div><div class="gear-actions gear-UR"><button class="secondary" id="gear-awaken" data-check="awaken">각성</button><button class="primary" data-check="equip">장착</button></div>'),
    'guild controls': modal('guild-modal', '<div class="guild-tabs"><button aria-pressed="true" data-check="selected">길드</button><button aria-pressed="false" data-check="unselected">퀘스트</button></div><form id="guild-create"><input data-check="name"><small data-check="hint">이름 입력</small></form>'),
    'winter tabs': modal('winter-modal', '<div id="school-social" data-view="winter"><div class="winter-tabs"><button aria-selected="true" data-check="selected">예티</button><button aria-selected="false" data-check="unselected">룰렛</button></div><div class="winter-wallets"><div class="winter-wallet" data-check="wallet">100<span data-check="currency">눈송이</span></div></div></div>'),
    'settings': modal('', SETTINGS),
    'battle settings': modal('battle-side', SETTINGS),
    'insights': modal('insights-modal', '<p class="modal-copy" data-check="body">전투 기록</p><p id="insight-status" data-check="status">업데이트 중</p><div class="insight-totals"><div><small data-check="total label">전체 피해</small></div></div><button class="secondary" data-check="button">닫기</button>'),
    'wardrobe': modal('skin-modal', '<div class="wardrobe"><p class="wardrobe-note" data-check="note">스킨</p><button class="secondary" data-check="button">돌아가기</button></div>'),
    'hero': modal('formation-hero-modal', '<div class="hero-management"><div class="hero-profile"><div class="hero-detail-header"><h3 data-check="hero name">호라스</h3><p data-check="hero role">원거리</p></div></div><div class="hero-growth"><div class="hero-stat-grid"><div data-check="stat">125<small data-check="stat label">레벨</small></div></div><p class="detail-note" data-check="growth note">레벨 상한</p></div></div>'),
    'gear': modal('equipment-modal', ''.join(f'<div class="gear-selected-heading gear-{grade}"><span class="gear-rarity gear-{grade}" data-check="{grade}">{grade}</span><p data-check="{grade} description">전용 무기</p></div>' for grade in ('R', 'SR', 'SSR', 'UR', 'EX'))),
    'shards': modal('shards-modal', '<div class="shard-wallet"><span class="shard-sr" data-check="SR wallet">SR 조각</span><span class="shard-ssr" data-check="SSR wallet">SSR 조각</span></div><div class="shard-section"><select data-check="select"><option>선택</option></select></div>'),
    'qol': modal('qol-modal', '<p class="preset-state" data-check="preset">사용 중</p><p class="qol-number" data-check="number">01</p><p class="farm-rank" data-check="rank">추천</p><div class="farm-estimate"><strong data-check="estimate">1000 코인</strong></div>'),
    'yeti': modal('yeti-modal', '<div id="yeti-join"><input id="yeti-code" data-check="input"></div><p id="yeti-message" data-error="true" data-check="error">초대 코드 확인</p>'),
    'raid': modal('raid-modal', '<div id="raid-view"><button class="secondary" data-check="button">초대</button><p id="raid-message" data-error="true" data-check="error">다시 시도</p></div>'),
    'social': modal('', '<div id="school-social"><p id="social-message" data-error="true" data-check="social error">다시 시도</p><p id="guild-message" data-error="true" data-check="guild error">다시 시도</p></div>'),
    'formation': '<div class="app" data-tab="roster"><div class="content-panel"><div id="tab-roster"><div class="formation-presets"><button aria-pressed="true" data-check="preset">모험</button></div><button class="filter active" data-check="selected filter">보유</button><div class="formation-footer"><button class="secondary" data-check="button">자동 배치</button></div></div></div></div>',
    'hud': '<div class="app" data-tab="supply"><header class="topbar"><div class="brand"><strong data-check="brand">학교용병단</strong><small data-check="brand note">진행 중</small></div><button class="captain"><span class="captain-emblem" data-check="name">단장</span><b data-check="level">Lv.20</b></button><div class="currency currency-gold"><b data-check="coins">1000</b></div></header><div class="content-panel"><input id="coupon-code" data-check="coupon input"><p id="coupon-message" data-state="error" data-check="coupon error">코드를 확인해 주세요</p></div></div>',
}

failures, count = [], 0
for theme in ('light', 'dark'):
    for case, markup in CASES.items():
        doc = html.fromstring(f'<html data-theme="{theme}"><body>{markup}</body></html>')
        styles, surfaces = {}, {}
        for node in cssselect2.ElementWrapper.from_html_root(doc).iter_subtree():
            parent = styles.get(node.parent, {})
            style = computed(node, parent)
            styles[node] = style
            bg = backgrounds(style, surfaces.get(node.parent, [(1, 1, 1, 1)]))
            surfaces[node] = bg
            if node.id == 'setting-theme':
                assert style['min-height'] == '28px', f'{theme}: switch expanded by input rules'
                assert style['border-radius'] == '999px', f'{theme}: switch corners overridden'
            label = node.etree_element.get('data-check')
            if label:
                fg = rgba(style.get('color', '#000'))
                assert fg, f'{theme}/{case}/{label}: unhandled color {style.get("color")}'
                ratio = min(contrast(over(fg, b), b) for b in bg)
                count += 1
                if ratio < 4.5:
                    failures.append(f'{theme}/{case}/{label}: {ratio:.2f}:1 ({style["color"]})')
assert not failures, '\n' + '\n'.join(failures)
print(f'PASS {count} light/dark text contrast checks (>=4.5:1), cascade and switch geometry')
