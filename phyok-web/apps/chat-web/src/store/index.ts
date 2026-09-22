import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, useStore, type TypedUseSelectorHook } from "react-redux";

import { chatReducer } from "./chat-slice";

export const makeStore = () =>
  configureStore({
    reducer: {
      chat: chatReducer
    },
    devTools: process.env.NODE_ENV !== "production"
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export const useAppStore = useStore.withTypes<AppStore>();
