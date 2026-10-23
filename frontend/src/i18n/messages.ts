import { appMessages } from './messagesApp';
import { tipMessages } from './messagesTips';
import { flowMessages } from './messagesFlow';
import { onboardingMessages } from './messagesOnboarding';

export const messages = { ...appMessages, ...flowMessages, ...tipMessages, ...onboardingMessages } as const;
