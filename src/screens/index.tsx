import type { ComponentType } from 'react';
import type { ScreenId } from '../state/types';
import { MerchantFrame } from '../components/MerchantFrame';
import { S01Entry, S01ExistingAccount, S01FutureAddCertificate, S02LLocked } from './EntryScreens';
import { S02Otp, S03Category } from './OtpCategoryScreens';
import { S04CrVerification, S05AuthorisedPerson, S06Nafath } from './VerificationScreens';
import { OutcomeA, OutcomeB, OutcomeC, S07Certificates, S07ManualCertificate, S08BusinessDetails, S09Contract, S09Declined } from './DetailsScreens';

export const SCREEN_COMPONENTS: Record<Exclude<ScreenId, 'S00'>, ComponentType> = {
  S01: S01Entry,
  'S01-X': S01ExistingAccount,
  'S01-F': S01FutureAddCertificate,
  S02: S02Otp,
  'S02-L': S02LLocked,
  S03: S03Category,
  S04: S04CrVerification,
  S05: S05AuthorisedPerson,
  S06: S06Nafath,
  S07: S07Certificates,
  'S07-M': S07ManualCertificate,
  S08: S08BusinessDetails,
  S09: S09Contract,
  'S09-D': S09Declined,
  'O-A': OutcomeA,
  'O-B': OutcomeB,
  'O-C': OutcomeC,
};

/** Renders the application's current screen inside the merchant frame. */
export function CurrentScreen({ screen }: { screen: Exclude<ScreenId, 'S00'> }) {
  const Component = SCREEN_COMPONENTS[screen];
  return (
    <MerchantFrame screen={screen}>
      <Component key={screen} />
    </MerchantFrame>
  );
}
