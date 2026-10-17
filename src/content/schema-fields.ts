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
