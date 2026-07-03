-- One-time script to fix stuffie rarities that were assigned incorrectly
-- before each stuffie was given a permanent rarity.
-- Run this once in Supabase SQL Editor → New Query.

update user_stuffies set rarity = 'common'    where stuffie_key in ('puppy','kitty','bunny','chick','pig','hamster','frog','turtle','bee','ladybug','hedgehog','penguin');
update user_stuffies set rarity = 'uncommon'  where stuffie_key in ('koala','panda','bear','fox','wolf','raccoon','otter','sloth','capybara','deer');
update user_stuffies set rarity = 'rare'      where stuffie_key in ('owl','bat','butterfly','lion','tiger','flamingo','dolphin','elephant');
update user_stuffies set rarity = 'epic'      where stuffie_key in ('peacock','parrot','octopus','crab','axolotl');
update user_stuffies set rarity = 'legendary' where stuffie_key in ('giraffe','zebra','whale');
update user_stuffies set rarity = 'mythic'    where stuffie_key in ('unicorn','dragon');
