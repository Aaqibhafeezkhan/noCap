import { appMessages } from './messagesApp';
import { tipMessages } from './messagesTips';
import { flowMessages } from './messagesFlow';

export const messages = { ...appMessages, ...flowMessages, ...tipMessages } as const;
