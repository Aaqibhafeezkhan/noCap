import { appMessages } from './messagesApp';
import { flowMessages } from './messagesFlow';

export const messages = { ...appMessages, ...flowMessages } as const;
