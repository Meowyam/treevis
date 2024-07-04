import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit';
import astVisReducer from '../features/ASTVis/astVisSlice';

export const store = configureStore({
  reducer: {
    astVis: astVisReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;