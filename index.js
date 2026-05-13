import axios from 'axios';
import nodemailer from 'nodemailer';

const PAT_TOKEN = process.env.PAT_TOKEN;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const BATTERY_THRESHOLD = 20;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const LOCATIONS = [
  { id: '4837b924-2210-4dc4-83b7-9a4c0364f810', name: '25A Grand' },
  { id: 'a24ea1c2-73d3-4f48-8a56-69a8162907ed', name: '25B-Grand' },
  { id: 'f6276e7a-343f-494e-8c0b-7dc1b7303127', name: '27A Grand' },
  { id: 'ff90c913-2631-4f61-bd0f-57c504cd4146', name: '31A Grand' },
  { id: 'ab46efea-5c37-4516-8eb7-5d76ddabfaf6', name: '29 C Grand' },
  { id: '57e30a74-286f-4020-85e3-b3cb940157d2', name: 'Beckerle' },
  { id: 'bb800a5b-394a-467a-bab8-8ad0445d054d', name: 'Beecher' },
  { id: '52fe184e-f00c-43a6-bf5e-83364e780077', name: 'Bethel Innovation Lab' },
  { id: 'cb4a3774-7b2e-4481-a8e9-0a59004d52fc', name: 'Blackman' },
  { id: '94ac1a0f-78ca-44bc-85f6-2a23a7509367', name: 'Burke CT' },
  { id: 'bb6745cf-de29-4c73-9492-ae5119f016ea', name: 'Carp1' },
  { id: 'f9c658d7-d211-4006-8cf2-5507cbd0f367', name: 'Carp2' },
  { id: '0411cf00-fdcf-4d37-a4ed-b62757ef6c4c', name: 'Carp3' },
  { id: 'e5390bfe-b369-41f2-b218-aaafbbbf8907', name: 'Carp4' },
  { id: 'eb508ff8-02ad-4337-9853-c5a90b8ddf9f', name: 'Carmel' },
  { id: 'a9f82d24-0124-4bca-b45b-33006e5b2c60', name: 'CCA' },
  { id: 'aea24347-f2eb-4011-8e24-e4f00032b9f8', name: 'Cleveland Unit 1' },
  { id: '6b6cd665-6830-4fa5-9e86-5c4186423cf5', name: 'Cleveland Unit 3' },
  { id: '727324c5-231b-4e35-8253-deca7059db1d', name: 'Corbin' },
  { id: '58e121db-b978-469d-b113-59112a5bf7cd', name: 'Cornell tester 2024' },
  { id: '3e1494a5-a6e7-4f28-b192-722b3ce56297', name: 'Crows Nest 4K' },
  { id: 'f9153f09-099b-4dee-b3c7-8bacff45be15', name: 'Dodgingtown' },
  { id: '63b4aa1b-0713-467d-9e26-71cf674ca702', name: 'Dorset' },
  { id: '75f02cd8-3bc8-4eff-ae57-d29a1a28d927', name: 'Foley' },
  { id: '271f9430-cd73-48e3-bcdd-6d17f72040a3', name: 'Howland' },
  { id: '24134771-f055-4c4a-ba65-1d81a4a60457', name: 'Hubbard' },
  { id: '3ed81f22-79d6-456d-a7d6-d1983a6fe8cf', name: 'Kelley ST Hub' },
  { id: 'b78594ec-32a4-4274-bcf1-33ef521b1355', name: 'Liberty 13' },
  { id: '3d9916e8-eb9c-42c0-8164-6c1ca8012394', name: 'Liberty 2' },
  { id: 'c2238096-4889-43ea-a126-8a8e3a5f0149', name: 'Maple' },
  { id: 'c6419b60-4873-4a20-b075-14dcb6c94c93', name: 'Millington' },
  { id: 'cd3b29cf-f425-42db-ab3d-ddfde4a7f6f6', name: 'Mountaindale' },
  {
