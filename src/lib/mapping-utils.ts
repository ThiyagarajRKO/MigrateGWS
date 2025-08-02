import { UserMapping } from '@/components/UserMappingVisualizer'

export interface CSVUserMapping {
  sourceEmails: string // comma-separated
  targetEmails: string // comma-separated
  mappingType: string
  scenario: string
  notes?: string
  targetExists?: string // 'true' | 'false'
}

export function parseMappingsFromCSV(csvText: string): UserMapping[] {
  const lines = csvText.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',').map(h => h.trim())
  
  if (headers.length < 4) {
    throw new Error('CSV must have at least: sourceEmails,targetEmails,mappingType,scenario')
  }

  const mappings: UserMapping[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    
    if (values.length < 4) continue

    const sourceUsers = values[0].split(';').map(email => email.trim()).filter(Boolean)
    const targetEmails = values[1].split(';').map(email => email.trim()).filter(Boolean)
    const mappingType = values[2] as UserMapping['mappingType']
    const scenario = values[3]
    const notes = values[4] || undefined
    const targetExists = values[5] === 'true'

    if (sourceUsers.length === 0) continue

    mappings.push({
      sourceUsers,
      targetUser: targetEmails.length === 1 ? targetEmails[0] : targetEmails,
      targetUserExists: targetExists,
      mappingType: ['merge', 'split', 'direct', 'create'].includes(mappingType) 
        ? mappingType 
        : 'direct',
      scenario,
      notes
    })
  }

  return mappings
}

export function generateCSVFromMappings(mappings: UserMapping[]): string {
  const headers = ['sourceEmails', 'targetEmails', 'mappingType', 'scenario', 'notes', 'targetExists']
  
  const csvLines = [
    headers.join(','),
    ...mappings.map(mapping => {
      const sourceEmails = mapping.sourceUsers.join(';')
      const targetEmails = Array.isArray(mapping.targetUser) 
        ? mapping.targetUser.join(';')
        : mapping.targetUser
      
      return [
        sourceEmails,
        targetEmails,
        mapping.mappingType,
        mapping.scenario,
        mapping.notes || '',
        mapping.targetUserExists.toString()
      ].join(',')
    })
  ]

  return csvLines.join('\\n')
}

export function generateSampleMappingsCSV(): string {
  const sampleMappings: UserMapping[] = [
    {
      sourceUsers: ['alice@company-a.com', 'alice@company-b.com'],
      targetUser: 'alice@newcorp.com',
      targetUserExists: true,
      mappingType: 'merge',
      scenario: 'Multi-source → Single Target',
      notes: 'Merging identities from different domains'
    },
    {
      sourceUsers: ['john@company-a.com'],
      targetUser: ['john.sales@newcorp.com', 'john.marketing@newcorp.com'],
      targetUserExists: false,
      mappingType: 'split',
      scenario: 'Single Source → Multi Target',
      notes: 'Splitting user into departmental accounts'
    },
    {
      sourceUsers: ['sarah@company-a.com'],
      targetUser: 'sarah.jones@newcorp.com',
      targetUserExists: true,
      mappingType: 'direct',
      scenario: 'Direct Migration (1:1)',
      notes: 'Simple one-to-one migration'
    }
  ]

  return generateCSVFromMappings(sampleMappings)
}

// Helper to detect mapping type from user counts
export function detectMappingType(sourceCount: number, targetCount: number): UserMapping['mappingType'] {
  if (sourceCount > 1 && targetCount === 1) return 'merge'
  if (sourceCount === 1 && targetCount > 1) return 'split'
  if (sourceCount === 1 && targetCount === 1) return 'direct'
  return 'create'
}

// Helper to generate scenario description
export function generateScenarioDescription(
  mappingType: UserMapping['mappingType'],
  sourceCount: number,
  targetCount: number,
  targetExists: boolean
): string {
  const existsText = targetExists ? 'Target Exists' : 'Target Not Exists'
  
  switch (mappingType) {
    case 'merge':
      return `Multi-source → Single Target (${existsText})`
    case 'split':
      return `Single Source → Multi Target (${existsText})`
    case 'direct':
      return `Direct Migration (1:1) (${existsText})`
    case 'create':
      return `Create New User (${existsText})`
    default:
      return `${sourceCount} → ${targetCount} Mapping (${existsText})`
  }
}
