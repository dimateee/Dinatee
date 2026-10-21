/* Статус подписки хранится на сервере (Netlify Blobs) и подтверждается подписью Telegram,
   поэтому его нельзя «включить» правкой данных на телефоне */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const Ctx = createContext(null);

export function PremiumProvider({ children }) {
  const [info, setInfo] = useState({ loading: true, premium: false, until: null, methods: [], priceRub: 150, priceStars: 100 });

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setInfo({ loading: false, ...data });
      return data;
    } catch (e) {
      setInfo((x) => ({ ...x, loading: false, error: e.message }));
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <Ctx.Provider value={{ ...info, refresh }}>{children}</Ctx.Provider>;
}

export const usePremium = () => useContext(Ctx);
