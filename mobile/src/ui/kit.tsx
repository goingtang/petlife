// Shared UI building blocks. Every screen is composed from these so the app looks consistent.
import React, { useState } from 'react';
import {
  Alert, Image, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { C, R } from './theme';
import { useNav } from '../nav';
import { useStore, initialOf } from '../lib/store';
import { parseYmd, ymd, isValidYmd } from '../lib/date';

// ---------- Text ----------

export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.h2, style]}>{children}</Text>;
}
export function P({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text style={[s.p, style]} numberOfLines={numberOfLines}>{children}</Text>;
}
export function Sub({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text style={[s.sub, style]} numberOfLines={numberOfLines}>{children}</Text>;
}
export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

// ---------- Layout ----------

/**
 * A full screen with an optional header. `root` screens (tabs) get room for the tab bar;
 * pushed screens get a back button.
 */
export function Screen({
  title, subtitle, children, right, root, scroll = true, footer, bg, scrollRef,
}: {
  title?: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode; root?: boolean;
  scroll?: boolean; footer?: React.ReactNode; bg?: string;
  /** Pass a ref to scroll programmatically, e.g. to an edit form that just opened. */
  scrollRef?: React.RefObject<any>;
}) {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const header = (
    <View style={{ gap: 4, marginBottom: 6 }}>
      {!root && (
        <View style={s.headRow}>
          <Pressable onPress={nav.back} style={s.back} accessibilityRole="button" accessibilityLabel="返回" hitSlop={8}>
            <Text style={{ fontSize: 15, color: C.ink, fontWeight: '500' }}>‹ 返回</Text>
          </Pressable>
          {right}
        </View>
      )}
      {(title || (root && right)) && (
        <View style={s.headRow}>
          {title ? <H1 style={{ flex: 1 }}>{title}</H1> : <View />}
          {root && right}
        </View>
      )}
      {subtitle ? <Sub>{subtitle}</Sub> : null}
    </View>
  );
  const pad = { paddingTop: insets.top + 12, paddingBottom: (root ? 110 : 40) + insets.bottom, paddingHorizontal: 20 };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg ?? C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView ref={scrollRef} contentContainerStyle={[pad, { gap: 16 }]} keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[pad, { flex: 1, gap: 16 }]}>
          {header}
          {children}
        </View>
      )}
      {footer ? <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 12, paddingTop: 8, backgroundColor: bg ?? C.bg }}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style, onPress, onLongPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; onLongPress?: () => void }) {
  if (onPress || onLongPress)
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        {children}
      </Pressable>
    );
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({ children, style, gap = 10 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void; kind?: BtnKind }; children?: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2 style={{ flex: 1 }}>{title}</H2>
        {action ? <Btn small kind={action.kind ?? 'outline'} title={action.label} onPress={action.onPress} /> : null}
      </Row>
      {children}
    </View>
  );
}

/** Divider-separated list inside one card. */
export function ListCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[s.card, { padding: 0, overflow: 'hidden' }, style]}>
      {items.map((c, i) => (
        <View key={i} style={i ? { borderTopWidth: 1.5, borderTopColor: C.lineSoft } : undefined}>
          {c}
        </View>
      ))}
    </View>
  );
}

export function KV({ k, v, style }: { k: string; v: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Row style={[{ justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'flex-start' }, style]}>
      <Text style={{ color: C.sub, fontSize: 14 }}>{k}</Text>
      {typeof v === 'string' || typeof v === 'number' ? <Text style={{ fontSize: 15, fontWeight: '500', color: C.ink, flexShrink: 1, textAlign: 'right' }}>{v}</Text> : v}
    </Row>
  );
}

export function Empty({ text, action }: { text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }}>
      <Sub style={{ textAlign: 'center' }}>{text}</Sub>
      {action ? <Btn small kind="outline" title={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

// ---------- Controls ----------

export type BtnKind = 'primary' | 'outline' | 'dark' | 'ghost' | 'danger' | 'soft';

export function Btn({
  title, onPress, kind = 'primary', small, disabled, style, textStyle, accessibilityLabel,
}: {
  title: string; onPress?: () => void; kind?: BtnKind; small?: boolean; disabled?: boolean;
  style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>; accessibilityLabel?: string;
}) {
  const k = BTN[kind];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        s.btn,
        small ? s.btnSmall : null,
        { backgroundColor: k.bg, borderColor: k.border, borderWidth: k.border === 'transparent' ? 0 : 1.5 },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 },
        style,
      ]}
    >
      <Text style={[{ color: k.fg, fontWeight: '700', fontSize: small ? 13 : 16, textAlign: 'center' }, textStyle]}>{title}</Text>
    </Pressable>
  );
}
const BTN: Record<BtnKind, { bg: string; fg: string; border: string }> = {
  primary: { bg: C.accent, fg: '#fff', border: 'transparent' },
  outline: { bg: 'transparent', fg: C.ink, border: C.ink },
  dark: { bg: C.ink, fg: C.bg, border: 'transparent' },
  ghost: { bg: 'transparent', fg: C.accent, border: 'transparent' },
  danger: { bg: 'transparent', fg: C.danger, border: C.danger },
  soft: { bg: C.card, fg: C.ink, border: C.line },
};

export function Chip({ label, on, onPress, style, leading }: { label: string; on?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>; leading?: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={[s.chip, on ? { backgroundColor: C.ink, borderColor: C.ink } : null, style]}
    >
      {leading}
      <Text style={{ color: on ? C.bg : C.ink, fontSize: 14, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  if (wrap) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
  return <ScrollChips>{children}</ScrollChips>;
}

/** Sideways chip row with a fade on the right edge while more chips are hidden off-screen. */
function ScrollChips({ children }: { children: React.ReactNode }) {
  const [more, setMore] = useState(false);
  const [w, setW] = useState(0);
  const [cw, setCw] = useState(0);
  React.useEffect(() => setMore(cw > w + 4), [w, cw]);
  return (
    <View style={{ marginHorizontal: -20 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        onContentSizeChange={(x) => setCw(x)}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          setMore(contentOffset.x + layoutMeasurement.width < contentSize.width - 8);
        }}
        scrollEventThrottle={64}
      >
        {children}
      </ScrollView>
      {more ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, flexDirection: 'row' }}>
          {[0.15, 0.35, 0.6, 0.85].map((o) => (
            <View key={o} style={{ flex: 1, backgroundColor: C.bg, opacity: o }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Pick one (or several, with `multi`) from a list of options shown as chips. */
export function Choice<T extends string>({
  options, value, onChange, multi, wrap = true,
}: {
  options: { value: T; label: string }[]; value: T | T[] | null; onChange: (v: any) => void; multi?: boolean; wrap?: boolean;
}) {
  const sel = (v: T) => (multi ? (value as T[] | null)?.includes(v) : value === v);
  return (
    <ChipRow wrap={wrap}>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          on={sel(o.value)}
          onPress={() => {
            if (!multi) return onChange(o.value);
            const cur = (value as T[] | null) ?? [];
            onChange(cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value]);
          }}
        />
      ))}
    </ChipRow>
  );
}

export function Segment<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segItem, on && s.segOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <Text style={{ fontSize: 14, fontWeight: on ? '700' : '500', color: C.ink }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label, value, onChangeText, placeholder, multiline, keyboardType, required, error, style, autoFocus,
}: {
  label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad' | 'email-address'; required?: boolean; error?: string | null;
  style?: StyleProp<ViewStyle>; autoFocus?: boolean;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>{label}</Label>
          {required ? <Text style={{ fontSize: 12, color: C.faint }}>必填</Text> : null}
        </Row>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        multiline={multiline}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        style={[s.input, multiline && { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }, error ? { borderColor: C.danger } : null]}
        accessibilityLabel={label ?? placeholder}
      />
      {error ? <Text style={{ fontSize: 12, color: C.danger, fontWeight: '500' }}>{error}</Text> : null}
    </View>
  );
}

/** Number input with a keypad (decimals allowed unless `integer`). Empty input reports null. */
export function NumberField({
  label, value, onChange, unit, integer, placeholder, error, required, min = 0,
}: {
  label?: string; value: number | null; onChange: (v: number | null) => void; unit?: string; integer?: boolean;
  placeholder?: string; error?: string | null; required?: boolean; min?: number;
}) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  React.useEffect(() => {
    const cur = text === '' ? null : Number(text);
    if (cur !== value) setText(value === null || value === undefined ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>{label}</Label>
          {required ? <Text style={{ fontSize: 12, color: C.faint }}>必填</Text> : null}
        </Row>
      ) : null}
      <View style={[s.input, { flexDirection: 'row', alignItems: 'center', paddingRight: 12 }, error ? { borderColor: C.danger } : null]}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            const clean = integer ? t.replace(/[^0-9]/g, '') : t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
            setText(clean);
            if (clean === '' || clean === '.') return onChange(null);
            const n = Number(clean);
            if (!isNaN(n)) onChange(Math.max(min, n));
          }}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          style={{ flex: 1, minWidth: 0, fontSize: 16, color: C.ink, minHeight: 46 }}
          accessibilityLabel={label ?? placeholder}
        />
        {unit ? <Text style={{ fontSize: 15, color: C.sub, flexShrink: 0, marginLeft: 6 }}>{unit}</Text> : null}
      </View>
      {error ? <Text style={{ fontSize: 12, color: C.danger, fontWeight: '500' }}>{error}</Text> : null}
    </View>
  );
}

/** Date input. Uses the phone's date picker; on web a plain YYYY-MM-DD box. */
export function DateField({ label, value, onChange, optional, error, max }: { label?: string; value: string; onChange: (v: string) => void; optional?: boolean; error?: string | null; /** latest allowed date (YYYY-MM-DD), e.g. today for birthdays */ max?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  React.useEffect(() => {
    if (value !== text && (isValidYmd(value) || !value)) setText(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  if (Platform.OS === 'web') {
    return (
      <Field
        label={label}
        value={text}
        placeholder="YYYY-MM-DD"
        error={error ?? (text && !isValidYmd(text) ? '日期格式：2026-11-01' : text && max && text > max ? `不能晚於 ${max.replace(/-/g, '/')}` : null)}
        onChangeText={(t) => {
          setText(t);
          if ((isValidYmd(t) && (!max || t <= max)) || (optional && !t)) onChange(t);
        }}
      />
    );
  }
  return (
    <View style={{ gap: 6 }}>
      {label ? <Label>{label}</Label> : null}
      <Row>
        <Pressable onPress={() => setOpen(true)} style={[s.input, { flex: 1, justifyContent: 'center' }, error ? { borderColor: C.danger } : null]} accessibilityRole="button" accessibilityLabel={label ?? '選擇日期'}>
          <Text style={{ fontSize: 15, color: value ? C.ink : C.faint }}>{value ? value.replace(/-/g, '/') : '選擇日期'}</Text>
        </Pressable>
        {optional && value ? <Btn small kind="ghost" title="清除" onPress={() => onChange('')} /> : null}
      </Row>
      {error ? <Text style={{ fontSize: 12, color: C.danger, fontWeight: '500' }}>{error}</Text> : null}
      {open ? (
        <DateTimePicker
          value={value ? parseYmd(value) : new Date()}
          maximumDate={max ? parseYmd(max) : undefined}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(e, d) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (e.type === 'set' && d) onChange(ymd(d));
            if (e.type === 'dismissed') setOpen(false);
          }}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? <Btn small kind="outline" title="完成" onPress={() => setOpen(false)} /> : null}
    </View>
  );
}

/** Time input ("HH:mm"). */
export function TimeField({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  if (Platform.OS === 'web') {
    return (
      <Field
        label={label}
        value={text}
        placeholder="08:00"
        onChangeText={(t) => {
          setText(t);
          if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) onChange(t);
        }}
      />
    );
  }
  const d = new Date();
  const [h, m] = (value || '08:00').split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Label>{label}</Label> : null}
      <Pressable onPress={() => setOpen(true)} style={[s.input, { justifyContent: 'center' }]} accessibilityRole="button" accessibilityLabel={label ?? '選擇時間'}>
        <Text style={{ fontSize: 15, color: C.ink }}>{value || '選擇時間'}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={d}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, x) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (e.type === 'set' && x) onChange(`${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`);
            if (e.type === 'dismissed') setOpen(false);
          }}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? <Btn small kind="outline" title="完成" onPress={() => setOpen(false)} /> : null}
    </View>
  );
}

export function Stepper({
  label, value, onChange, step = 1, min = 0, max = 1e9, unit, decimals = 0,
}: {
  label?: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; decimals?: number;
}) {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const fmt = decimals ? Number(value).toFixed(decimals).replace(/\.?0+$/, '') : String(Math.round(value));
  return (
    <View style={{ gap: 6 }}>
      {label ? <Label>{label}</Label> : null}
      <View style={s.stepper}>
        <Pressable onPress={() => onChange(Math.max(min, round(value - step)))} style={s.stepBtn} accessibilityRole="button" accessibilityLabel="減少">
          <Text style={{ fontSize: 22, color: C.ink }}>−</Text>
        </Pressable>
        <Text style={{ fontSize: 30, fontWeight: '600', color: C.ink }}>
          {fmt}
          {unit ? <Text style={{ fontSize: 15, color: C.sub, fontWeight: '400' }}> {unit}</Text> : null}
        </Text>
        <Pressable onPress={() => onChange(Math.min(max, round(value + step)))} style={s.stepBtn} accessibilityRole="button" accessibilityLabel="增加">
          <Text style={{ fontSize: 22, color: C.ink }}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={s.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, color: C.ink, fontWeight: '500' }}>{label}</Text>
        {hint ? <Sub>{hint}</Sub> : null}
      </View>
      <View style={[s.track, { backgroundColor: value ? C.green : '#E0D2BF' }]}>
        <View style={[s.knob, { transform: [{ translateX: value ? 20 : 0 }] }]} />
      </View>
    </Pressable>
  );
}

export function Badge({ text, bg = C.sand, fg = C.ink, style }: { text: string; bg?: string; fg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' }, style]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Progress({ pct, color = C.green, height = 8 }: { pct: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: C.line, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function Avatar({ name, color, size = 32, photo, textColor = '#fff' }: { name: string; color: string; size?: number; photo?: string; textColor?: string }) {
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={name} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: textColor, fontSize: Math.max(12, size * 0.42), fontWeight: '700' }}>{initialOf(name)}</Text>
    </View>
  );
}

/** Horizontal pet selector. `allowAll` adds a "全部" chip with value 'all'. */
export function PetChips({ value, onChange, allowAll }: { value: string | null; onChange: (id: string) => void; allowAll?: boolean }) {
  const { store } = useStore();
  if (!store.pets.length) return null;
  return (
    <ChipRow>
      {allowAll ? <Chip label="全部" on={value === 'all'} onPress={() => onChange('all')} /> : null}
      {store.pets.map((p) => (
        <Chip
          key={p.id}
          label={p.name}
          on={p.id === value}
          onPress={() => onChange(p.id)}
          style={{ paddingLeft: 5 }}
          leading={<Avatar name={p.name} color={p.color} size={28} photo={p.photo} textColor={C.ink} />}
        />
      ))}
    </ChipRow>
  );
}

export function PhotoGrid({ photos, onRemove, onAdd, max = 4, size = 76 }: { photos: string[]; onRemove?: (i: number) => void; onAdd?: () => void; max?: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {photos.map((u, i) => (
        <View key={u + i} style={{ width: size, height: size, borderRadius: 14, overflow: 'hidden', backgroundColor: C.sand2 }}>
          <Image source={{ uri: u }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`照片 ${i + 1}`} />
          {onRemove ? (
            <Pressable onPress={() => onRemove(i)} style={s.photoX} accessibilityRole="button" accessibilityLabel={`移除第 ${i + 1} 張照片`} hitSlop={8}>
              <Text style={{ color: '#fff', fontSize: 12 }}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {onAdd && photos.length < max ? (
        <Pressable onPress={onAdd} style={[s.photoAdd, { width: size, height: size }]} accessibilityRole="button" accessibilityLabel="加入照片">
          <Text style={{ fontSize: 22, color: C.sub }}>＋</Text>
          <Text style={{ fontSize: 12, color: C.sub }}>拍照／相簿</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Banner({ text, kind = 'info', action }: { text: string; kind?: 'info' | 'warn' | 'danger' | 'ok'; action?: { label: string; onPress: () => void } }) {
  const map = { info: [C.blueBg, C.blueInk], warn: [C.yellowBg, '#5E4512'], danger: [C.dangerBg, '#8A3A1F'], ok: [C.greenBg, '#3F5A3B'] } as const;
  const [bg, fg] = map[kind];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 16, padding: 14, gap: 10 }}>
      <Text style={{ color: fg, fontSize: 14, lineHeight: 21, fontWeight: '500' }}>{text}</Text>
      {action ? <Btn small kind="outline" title={action.label} onPress={action.onPress} style={{ alignSelf: 'flex-start', borderColor: fg }} textStyle={{ color: fg }} /> : null}
    </View>
  );
}

/**
 * Ask before an action. Uses a native dialog on phones. Destructive by default (red button on iOS);
 * pass `{ destructive: false }` for plain questions, `onCancel` to react to 取消.
 */
export function confirm(title: string, message: string, onYes: () => void, yesLabel = '刪除', opts?: { onCancel?: () => void; destructive?: boolean; cancelLabel?: string }) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${title}\n${message}`)) onYes();
    else opts?.onCancel?.();
    return;
  }
  Alert.alert(
    title,
    message,
    [
      { text: opts?.cancelLabel ?? '取消', style: 'cancel', onPress: opts?.onCancel },
      { text: yesLabel, style: opts?.destructive === false ? 'default' : 'destructive', onPress: onYes },
    ],
    { cancelable: true, onDismiss: opts?.onCancel },
  );
}

export const s = StyleSheet.create({
  h1: { fontSize: 27, fontWeight: '700', color: C.ink, lineHeight: 34 },
  h2: { fontSize: 19, fontWeight: '700', color: C.ink },
  p: { fontSize: 15, color: C.body, lineHeight: 23 },
  sub: { fontSize: 13, color: C.sub, lineHeight: 19 },
  label: { fontSize: 13, color: C.sub, fontWeight: '500' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  back: { height: 44, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.line, padding: 16 },
  btn: { minHeight: 50, borderRadius: 25, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { minHeight: 44, borderRadius: 22, paddingHorizontal: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: C.sand2 },
  segItem: { flex: 1, minHeight: 44, borderRadius: 19, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOn: { backgroundColor: C.card, shadowColor: '#3B2F28', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  input: { minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 16, fontSize: 15, color: C.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderRadius: 24, backgroundColor: C.sand },
  stepBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingLeft: 16, paddingRight: 8, paddingVertical: 8, borderRadius: 26, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card },
  track: { width: 52, height: 32, borderRadius: 16, padding: 3 },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  photoX: { position: 'absolute', top: 2, right: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(59,47,40,.75)', alignItems: 'center', justifyContent: 'center' },
  photoAdd: { borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CDBBA6', alignItems: 'center', justifyContent: 'center', gap: 2 },
});
