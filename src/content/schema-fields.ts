// Field specs shared by the content schemas.
import { list, num, obj, oneOf, str } from './schema';

export const id = str();
export const text = str();
export const texts = list(str());
export const share = num({ min: 0, max: 1 });
export const count = num({ min: 0 });
export const attribute = oneOf(
  'strength',
  'agility',
  'endurance',
  'intellect',
  'willpower',
  'perception',
  'charisma',
);
export const attributes = obj({
  strength: num(),
  agility: num(),
  endurance: num(),
  intellect: num(),
  willpower: num(),
  perception: num(),
  charisma: num(),
});
export const ageRisk = obj({ child: num(), adult: num(), elder: num() });
export const season = oneOf('spring', 'summer', 'autumn', 'winter');

// Seen at work (V-190, V-194): how a job looks while it is worked, drawn by the map from these
// alone. `motion` is one of the drawn motions; `effect` is what flies from it (specks thrown at
// each strike, a rising puff, or a slow drift), in its colours, `count` a time.
export const motion = oneOf('swing', 'dig', 'crouch', 'stir', 'bench', 'carry', 'none');
export const effect = obj({
  kind: oneOf('specks', 'puff', 'drift'),
  colours: list(str()),
  count: num({ min: 1, max: 20 }),
});
