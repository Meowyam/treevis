import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../app/store';

export interface ASTNode {
  name: string;
  children?: ASTNode[];
}

interface ASTVisState {
  ast: ASTNode | null;
}

const initialState: ASTVisState = {
  ast: null,
};

export const astVisSlice = createSlice({
  name: 'astVis',
  initialState,
  reducers: {
    setAST: (state, action: PayloadAction<ASTNode>) => {
      state.ast = action.payload;
    },
  },
});

export const { setAST } = astVisSlice.actions;

export const selectAST = (state: RootState) => state.astVis.ast;

export default astVisSlice.reducer;
