export const STATES = {
  IDLE: 'idle',
  MENU: 'menu',
  AWAITING_NAME: 'awaiting_name',
  AWAITING_PICK: 'awaiting_pick',
  IN_BRAIN: 'in_brain',
  AWAITING_QUESTION: 'awaiting_question',
};

export const PARENT = {
  [STATES.MENU]: STATES.IDLE,
  [STATES.AWAITING_NAME]: STATES.MENU,
  [STATES.AWAITING_PICK]: STATES.AWAITING_NAME,
  [STATES.IN_BRAIN]: STATES.MENU,
  [STATES.AWAITING_QUESTION]: STATES.IN_BRAIN,
};
