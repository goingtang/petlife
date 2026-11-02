import React, { useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../lib/store';
import { useNav, useBackHandler } from '../nav';
import { Btn, Field, Screen, Sub, Toggle, confirm } from '../ui/kit';
import type { Vet } from '../lib/types';

export default function VetEditScreen({ params }: { params: any }) {
  const { store, update, toast } = useStore();
  const nav = useNav();
  const er: boolean = !!params.er; // edit the shared night/holiday emergency hospital instead of a pet's vet
  const petId: string = params.petId ?? store.pets[0]?.id;
  const pet = store.pets.find((p) => p.id === petId);
  const blank: Vet = { name: '', doctor: '', phone: '', addr: '', hours: '' };
  const [v, setV] = useState<Vet>({ ...blank, ...((er ? store.erVet : store.vets[petId]) ?? {}) });
  const [initial] = useState(v);
  useBackHandler(
    JSON.stringify(v) !== JSON.stringify(initial)
      ? () => {
          confirm('放棄未儲存的內容？', '剛才修改的醫院資料不會保存。', () => nav.pop(), '放棄');
          return true;
        }
      : null,
  );
  const [all, setAll] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (k: keyof Vet, x: string) => setV((o) => ({ ...o, [k]: x }));
  const err = (k: keyof Vet) => (tried && !v[k].trim() ? '必填' : null);

  const save = () => {
    setTried(true);
    if (!v.name.trim() || !v.phone.trim()) return;
    const clean: Vet = { name: v.name.trim(), doctor: v.doctor.trim(), phone: v.phone.trim(), addr: v.addr.trim(), hours: v.hours.trim() };
    update((d) => {
      if (er) {
        d.erVet = clean;
        return;
      }
      const ids = all ? d.pets.map((p) => p.id) : [petId];
      ids.forEach((id) => {
        d.vets[id] = { ...clean };
      });
    });
    toast(er ? '已更新夜間急診醫院' : '已更新主治醫院');
    nav.pop();
  };

  return (
    <Screen
      title={er ? '夜間／假日急診醫院' : '主治醫院'}
      subtitle={er ? '主治醫院休診時可以去的 24 小時醫院，所有寵物共用' : pet ? `${pet.name}的主治醫院` : undefined}
      footer={
        <View style={{ gap: 8 }}>
          <Btn title="儲存" onPress={save} />
          {er && store.erVet ? <Btn kind="danger" title="移除" onPress={() =>
                confirm('移除夜間急診醫院？', '緊急求助頁將不再顯示這家醫院。', () => {
                  update((d) => {
                    d.erVet = null;
                  });
                  nav.pop();
                }, '移除')
              } /> : null}
        </View>
      }
    >
      <Field label="醫院名稱" required value={v.name} onChangeText={(t) => set('name', t)} placeholder="例如：安心動物醫院" error={err('name')} />
      <Field label="主治醫師" value={v.doctor} onChangeText={(t) => set('doctor', t)} placeholder="例如：王醫師" />
      <Field label="電話" required value={v.phone} onChangeText={(t) => set('phone', t)} keyboardType="phone-pad" placeholder="例如：02-2700-1234" error={err('phone')} />
      <Field label="地址" value={v.addr} onChangeText={(t) => set('addr', t)} placeholder="用於導航" />
      <Field label="看診時間" value={v.hours} onChangeText={(t) => set('hours', t)} placeholder="例如：09:00–21:00、24 小時" />
      {!er && store.pets.length > 1 ? <Toggle label="套用到所有寵物" value={all} onChange={setAll} /> : null}
      <View>
        <Sub>{er ? '緊急求助頁會顯示這家醫院，可一鍵撥打與導航。' : '緊急求助、AI 健康助理和健康紀錄都會使用這裡的電話。'}</Sub>
      </View>
    </Screen>
  );
}
