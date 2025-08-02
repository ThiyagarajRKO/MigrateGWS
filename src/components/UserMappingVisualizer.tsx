import React from 'react'
import { ArrowRight, Users, User, Info, Mail, CheckCircle, XCircle, Copy, Split, Merge, Plus, X } from 'lucide-react'

export interface UserMapping {
  sourceUsers: string[]
  targetUser: string | string[]
  targetUserExists: boolean
  mappingType: 'merge' | 'split' | 'direct' | 'create'
  scenario: string
  notes?: string
}

interface UserMappingVisualizerProps {
  mappings: UserMapping[]
  onUpdateMapping?: (index: number, mapping: UserMapping) => void
  onDeleteMapping?: (index: number) => void
  showEditControls?: boolean
  className?: string
}

interface UserBadgeProps {
  email: string
  exists?: boolean
  variant?: 'source' | 'target'
  className?: string
}

const UserBadge: React.FC<UserBadgeProps> = ({ email, exists, variant = 'source', className = '' }) => {
  const baseClasses = "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors"
  
  const variantClasses = {
    source: "bg-blue-100 text-blue-800 border border-blue-200",
    target: exists 
      ? "bg-green-100 text-green-800 border border-green-200" 
      : "bg-gray-100 text-gray-600 border border-gray-300 border-dashed"
  }

  const statusIcon = variant === 'target' ? (
    exists ? (
      <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
    ) : (
      <XCircle className="w-3 h-3 mr-1 text-gray-500" />
    )
  ) : (
    <Mail className="w-3 h-3 mr-1 text-blue-600" />
  )

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {statusIcon}
      {email}
    </span>
  )
}

interface MappingTypeProps {
  type: UserMapping['mappingType']
  className?: string
}

const MappingTypeBadge: React.FC<MappingTypeProps> = ({ type, className = '' }) => {
  const typeConfig = {
    merge: {
      label: 'Merge',
      icon: Merge,
      classes: 'bg-purple-100 text-purple-800 border-purple-200'
    },
    split: {
      label: 'Split',
      icon: Split,
      classes: 'bg-orange-100 text-orange-800 border-orange-200'
    },
    direct: {
      label: 'Direct',
      icon: Copy,
      classes: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    create: {
      label: 'Create',
      icon: Plus,
      classes: 'bg-green-100 text-green-800 border-green-200'
    }
  }

  const config = typeConfig[type]
  const IconComponent = config.icon

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border ${config.classes} ${className}`}>
      <IconComponent className="w-3 h-3 mr-1" />
      {config.label}
    </span>
  )
}

// Helper function to generate target users based on source user's name
const generateTargetUsers = (sourceUser: string, domain: string = 'newcorp.com'): string[] => {
  const emailPart = sourceUser.split('@')[0]
  const nameParts = emailPart.split('.')
  
  if (nameParts.length >= 2) {
    const [firstName, lastName] = nameParts
    return [
      `${firstName}.${lastName}@${domain}`,
      `${firstName}.sales@${domain}`,
      `${firstName}.marketing@${domain}`
    ]
  }
  
  return [`${emailPart}@${domain}`]
}

interface UserMappingCardProps {
  mapping: UserMapping
  index: number
  onUpdate?: (index: number, mapping: UserMapping) => void
  onDelete?: (index: number) => void
  showEditControls?: boolean
}

const UserMappingCard: React.FC<UserMappingCardProps> = ({ 
  mapping, 
  index, 
  onUpdate,
  onDelete,
  showEditControls = false 
}) => {
  // Handle target user generation if not provided
  const targetUsers = Array.isArray(mapping.targetUser) 
    ? mapping.targetUser 
    : mapping.targetUser 
      ? [mapping.targetUser]
      : generateTargetUsers(mapping.sourceUsers[0])

  const getArrowStyle = () => {
    if (mapping.mappingType === 'merge') return 'text-purple-600'
    if (mapping.mappingType === 'split') return 'text-orange-600'
    if (mapping.mappingType === 'direct') return 'text-blue-600'
    return 'text-green-600'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
          <MappingTypeBadge type={mapping.mappingType} />
        </div>
        <div className="flex items-center space-x-2">
          {mapping.notes && (
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute right-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                {mapping.notes}
              </div>
            </div>
          )}
          {showEditControls && onDelete && (
            <button
              onClick={() => onDelete(index)}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete mapping"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scenario Label */}
      <div className="mb-4">
        <span className="text-sm font-medium text-gray-700 bg-gray-50 px-2 py-1 rounded">
          {mapping.scenario}
        </span>
      </div>

      {/* Mapping Visualization */}
      <div className="space-y-4">
        {/* Source Users */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Source {mapping.sourceUsers.length > 1 ? 'Users' : 'User'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {mapping.sourceUsers.map((email, idx) => (
              <UserBadge key={idx} email={email} variant="source" />
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className={`w-6 h-6 ${getArrowStyle()}`} />
        </div>

        {/* Target Users */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Target {targetUsers.length > 1 ? 'Users' : 'User'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {targetUsers.map((email, idx) => (
              <UserBadge 
                key={idx} 
                email={email} 
                exists={mapping.targetUserExists} 
                variant="target" 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      {mapping.notes && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-600">{mapping.notes}</p>
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{mapping.sourceUsers.length} source → {targetUsers.length} target</span>
          <span className="capitalize">{mapping.mappingType} mapping</span>
        </div>
      </div>
    </div>
  )
}

const UserMappingVisualizer: React.FC<UserMappingVisualizerProps> = ({ 
  mappings, 
  onUpdateMapping,
  onDeleteMapping,
  showEditControls = false,
  className = '' 
}) => {
  const stats = {
    totalMappings: mappings.length,
    totalSourceUsers: mappings.reduce((acc, m) => acc + m.sourceUsers.length, 0),
    totalTargetUsers: mappings.reduce((acc, m) => {
      const targets = Array.isArray(m.targetUser) ? m.targetUser : [m.targetUser]
      return acc + targets.length
    }, 0),
    existingTargets: mappings.filter(m => m.targetUserExists).length,
    mappingTypes: mappings.reduce((acc, m) => {
      acc[m.mappingType] = (acc[m.mappingType] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          User Mapping Visualization
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Visual representation of Google Workspace migration user mappings
        </p>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-md p-3 border">
            <div className="text-2xl font-bold text-blue-600">{stats.totalMappings}</div>
            <div className="text-xs text-gray-500">Total Mappings</div>
          </div>
          <div className="bg-white rounded-md p-3 border">
            <div className="text-2xl font-bold text-green-600">{stats.totalSourceUsers}</div>
            <div className="text-xs text-gray-500">Source Users</div>
          </div>
          <div className="bg-white rounded-md p-3 border">
            <div className="text-2xl font-bold text-purple-600">{stats.totalTargetUsers}</div>
            <div className="text-xs text-gray-500">Target Users</div>
          </div>
          <div className="bg-white rounded-md p-3 border">
            <div className="text-2xl font-bold text-orange-600">{stats.existingTargets}</div>
            <div className="text-xs text-gray-500">Existing Targets</div>
          </div>
        </div>

        {/* Mapping Type Distribution */}
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(stats.mappingTypes).map(([type, count]) => (
            <MappingTypeBadge 
              key={type} 
              type={type as UserMapping['mappingType']} 
              className="text-xs"
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4 border">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <UserBadge email="example@source.com" variant="source" className="text-xs" />
              <span className="text-gray-600">Source user</span>
            </div>
            <div className="flex items-center space-x-2">
              <UserBadge email="example@target.com" exists={true} variant="target" className="text-xs" />
              <span className="text-gray-600">Existing target user</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <UserBadge email="example@target.com" exists={false} variant="target" className="text-xs" />
              <span className="text-gray-600">New target user</span>
            </div>
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Hover for notes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mapping Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mappings.map((mapping, index) => (
          <UserMappingCard 
            key={index} 
            mapping={mapping} 
            index={index}
            onUpdate={onUpdateMapping}
            onDelete={onDeleteMapping}
            showEditControls={showEditControls}
          />
        ))}
      </div>
    </div>
  )
}

export default UserMappingVisualizer
