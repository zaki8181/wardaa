import { read, utils } from 'xlsx';

export type ParsedVoter = {
  full_name: string;
  national_id?: string;
  voter_number?: string;
  school?: string;
  section?: string;
  type?: string;
};

const COL_MAP: Record<string, keyof ParsedVoter> = {};
const aliases: [string[], keyof ParsedVoter][] = [
  [['الاسم', 'الاسم الكامل', 'full_name', 'name', 'اسم'], 'full_name'],
  [['رقم البطاقة', 'رقم البطاقة الوطنية', 'national_id', 'cin', 'بطاقة'], 'national_id'],
  [['رقم الناخب', 'voter_number', 'رقم'], 'voter_number'],
  [['المكتب', 'المدرسة', 'school', 'مدرسة', 'مكتب'], 'school'],
  [['القسم', 'section', 'قسم'], 'section'],
  [['التصنيف', 'النوع', 'type', 'نوع', 'تصنيف'], 'type'],
];
for (const [names, key] of aliases) for (const n of names) COL_MAP[n.toLowerCase()] = key;

function matchCol(header: string): keyof ParsedVoter | undefined {
  return COL_MAP[header.trim().toLowerCase()];
}

export async function parseVoterExcel(file: File): Promise<ParsedVoter[]> {
  const buf = await file.arrayBuffer();
  const wb = read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const result: ParsedVoter[] = [];

  for (const row of rows) {
    const mapped: Partial<ParsedVoter> = {};
    for (const key of Object.keys(row)) {
      const field = matchCol(key);
      if (field) {
        const v = row[key];
        if (v !== undefined && v !== null) mapped[field] = String(v).trim();
      }
    }
    if (mapped.full_name) {
      result.push({
        full_name: mapped.full_name,
        national_id: mapped.national_id || undefined,
        voter_number: mapped.voter_number || undefined,
        school: mapped.school || undefined,
        section: mapped.section || undefined,
        type: mapped.type || undefined,
      });
    }
  }
  return result;
}

export function generateVoterTemplate(): string {
  const header = ['الاسم الكامل', 'رقم البطاقة الوطنية', 'رقم الناخب', 'المدرسة', 'القسم', 'التصنيف'];
  const rows = [
    ['أحمد محمد', 'AB123456', '12345', 'مدرسة ابن خلدون', 'القسم 1', 'الناخبون'],
    ['سارة علي', 'CD789012', '67890', 'مدرسة الفارابي', 'القسم 2', 'متعاطف'],
  ];
  return '\uFEFF' + [header, ...rows].map(r => r.join(',')).join('\n');
}
