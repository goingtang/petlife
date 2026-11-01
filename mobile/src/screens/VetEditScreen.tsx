import React, { useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Btn, Field, Screen, Sub, Toggle } from '../ui/kit';
import type { Vet } from '../lib/types';

export default function VetEditScreen({ params }: { params: any }) {
  const { store, update, toast } = useStore();
  const nav = useNav();
  const petId: string = params.petId ?? store.pets[0]?.id;
  const pet = store.pets.find((p) => p.id === petId);
  const [v, setV] = useState<Vet>(store.vets[petId] ?? { name: '', doctor: '', phone: '', addr: '', hours: '' });
  const [all, setAll] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (k: keyof Vet, x: string) => setV((o) => ({ ...o, [k]: x }));
  const err = (k: keyof Vet) => (tried && !v[k].trim() ? '必填' : null);

  const save = () => {
    setTried(true);
    if (!v.name.trim() || !v.phone.trim()) return;
    const clean: Vet = { name: v.name.trim(), doctor: v.doctor.trim(), phone: v.phone.trim(), addr: v.addr.trim(), hours: v.hours.trim() };
    update((d) => {
      const ids = all ? d.pets.map((p) => p.id) : [petId];
      ids.forEach((id) => {
        d.vets[id] = { ...clean };
      });
    });
    toast('已更新主治醫院');
    nav.pop();
  };

  return (
    <Screen title="主治醫院" subtitle={pet ? `${pet.name}的主治醫院` : undefined} footer={<Btn title="儲存" onPress={save} />}>
      <Field label="醫院名稱" required value={v.name} onChangeText={(t) => set('name', t)} placeholder="例如：安心動物醫院" error={err('name')} />
      <Field label="主治醫師" value={v.doctor} onChangeText={(t) => set('doctor', t)} placeholder="例如：王醫師" />
      <Field label="電話" required value={v.phone} onChangeText={(t) => set('phone', t)} keyboardType="phone-pad" placeholder="例如：02-2700-1234" error={err('phone')} />
      <Field label="地址" value={v.addr} onChangeText={(t) => set('addr', t)} placeholder="用於導航" />
      <Field label="看診時間" value={v.hours} onChangeText={(t) => set('hours', t)} placeholder="例如：09:00–21:00、24 小時" />
      {store.pets.length > 1 ? <Toggle label="套用到所有寵物" value={all} onChange={setAll} /> : null}
      <View>
        <Sub>緊急求助、AI 健康助理和健康紀錄都會使用這裡的電話。</Sub>
      </View>
    </Screen>
  );
}
