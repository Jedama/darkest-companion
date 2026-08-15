// src/components/CharacterPanel/TitlePage.tsx
import { useEstateContext } from '../../contexts/EstateContext.js';
import crestSrc from '../../assets/ui/panels/characterpanel/crest.png';
import './TitlePage.css';

interface TitlePageProps {
  /** False once a character is selected — the sheet takes the page. */
  visible: boolean;
}

function ordinal(n: number): string {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function TitlePage({ visible }: TitlePageProps) {
  const { currentEstate } = useEstateContext();
  if (!currentEstate) return null;

  const { name, time, money, characters, leadership } = currentEstate;

  // leadership holds identifiers ('heiress'), not display names.
  const margrave = characters[leadership?.margrave ?? '']?.name;
  const bursar = characters[leadership?.bursar ?? '']?.name;

  const souls = Object.keys(characters).length;

  const soulsPart =
    souls === 0
      ? 'The hamlet is empty'
      : `${souls} ${souls === 1 ? 'soul' : 'souls'} in service`;

  const coinPart =
    money === 0
      ? 'The coffer is empty'
      : `${money.toLocaleString('en-US')} pieces of coin`;

  // Two empty halves become two sentences, not a tally.
  const tallyLine =
    souls === 0 && money === 0
      ? 'The hamlet is empty. The coffer is empty.'
      : `${soulsPart} \u00B7 ${coinPart}`;

  // Month 0 is the prologue. Days are 0-based within the month.
  const dateLine =
    time.month === 0
      ? 'Prologue'
      : `${ordinal(time.month)} Month \u00B7 ${ordinal(time.day + 1)} Day`;

  return (
    <div className={`title-page${visible ? '' : ' is-hidden'}`}>
      <div className="title-page-inner">

        <div className="title-page-head">
          <div className="title-page-estate">{name}</div>

          <div className="title-page-subtitle">
            <span>Wherein are Set Down All Who Have</span>
            <span>Laboured to Cleanse the Estate</span>
          </div>

          <div className="title-page-rule" />

          <div className="title-page-attribution">
            {margrave && <span>Under the hand of {margrave}, Margrave</span>}
            {bursar && <span>Kept by {bursar}, Bursar</span>}
          </div>
        </div>

        <div className="title-page-device">
          <img className="title-page-crest" src={crestSrc} alt="" />
        </div>

        <div className="title-page-foot">
          <div className="title-page-rule title-page-rule-foot" />
          <div className="title-page-tally">{tallyLine}</div>
          <div className="title-page-date">{dateLine}</div>
        </div>

      </div>
    </div>
  );
}