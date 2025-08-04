/**
 * Enhanced Migration Execution Options Component
 * Integrates advanced optimization features with existing migration flow
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Settings, 
  Zap, 
  Shield, 
  Users, 
  Clock, 
  AlertTriangle,
  Info,
  Play,
  Pause,
  Square
} from 'lucide-react';

export interface MigrationExecutionOptions {
  prioritizeSpeed?: boolean;
  prioritizeReliability?: boolean;
  maxConcurrentUsers?: number;
  deltaMode?: boolean;
  dryRun?: boolean;
  pauseOnError?: boolean;
  notificationWebhook?: string;
}

interface Props {
  options: MigrationExecutionOptions;
  onOptionsChange: (options: MigrationExecutionOptions) => void;
  disabled?: boolean;
}

export function EnhancedMigrationOptions({ options, onOptionsChange, disabled = false }: Props) {
  const [localOptions, setLocalOptions] = useState<MigrationExecutionOptions>(options);

  const updateOption = (key: keyof MigrationExecutionOptions, value: any) => {
    const updated = { ...localOptions, [key]: value };
    setLocalOptions(updated);
    onOptionsChange(updated);
  };

  const getEstimatedTime = () => {
    const baseTime = 30; // minutes per user
    const concurrency = localOptions.maxConcurrentUsers || 1;
    const speedFactor = localOptions.prioritizeSpeed ? 0.7 : 1;
    const reliabilityFactor = localOptions.prioritizeReliability ? 1.3 : 1;
    
    return Math.round(baseTime * speedFactor * reliabilityFactor / concurrency);
  };

  const getRiskLevel = () => {
    if (localOptions.prioritizeSpeed && !localOptions.prioritizeReliability) return 'high';
    if (localOptions.prioritizeReliability) return 'low';
    return 'medium';
  };

  return (
    <div className="space-y-6">
      {/* Optimization Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Optimization Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Prioritize Speed
                </label>
                <Switch
                  checked={localOptions.prioritizeSpeed}
                  onCheckedChange={(checked: boolean) => updateOption('prioritizeSpeed', checked)}
                  disabled={disabled}
                />
              </div>
              <p className="text-xs text-gray-600">
                Optimize for faster migration with higher concurrency
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4 text-green-500" />
                  Prioritize Reliability
                </label>
                <Switch
                  checked={localOptions.prioritizeReliability}
                  onCheckedChange={(checked: boolean) => updateOption('prioritizeReliability', checked)}
                  disabled={disabled}
                />
              </div>
              <p className="text-xs text-gray-600">
                Optimize for data integrity with robust error handling
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Concurrency Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Concurrency Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Max Concurrent Users: {localOptions.maxConcurrentUsers || 10}
              </label>
              <Badge variant={localOptions.maxConcurrentUsers! > 15 ? 'destructive' : 'secondary'}>
                {localOptions.maxConcurrentUsers! > 15 ? 'High Load' : 'Safe'}
              </Badge>
            </div>
            <Slider
              value={[localOptions.maxConcurrentUsers || 10]}
              onValueChange={([value]: number[]) => updateOption('maxConcurrentUsers', value)}
              min={1}
              max={20}
              step={1}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Conservative</span>
              <span>Aggressive</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Migration Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Migration Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Delta Mode</label>
                <Switch
                  checked={localOptions.deltaMode}
                  onCheckedChange={(checked: boolean) => updateOption('deltaMode', checked)}
                  disabled={disabled}
                />
              </div>
              <p className="text-xs text-gray-600">
                Only migrate new/changed data since last sync
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Dry Run</label>
                <Switch
                  checked={localOptions.dryRun}
                  onCheckedChange={(checked: boolean) => updateOption('dryRun', checked)}
                  disabled={disabled}
                />
              </div>
              <p className="text-xs text-gray-600">
                Simulate migration without making changes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Handling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Handling
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Pause on Error</label>
              <Switch
                checked={localOptions.pauseOnError}
                onCheckedChange={(checked: boolean) => updateOption('pauseOnError', checked)}
                disabled={disabled}
              />
            </div>
            <p className="text-xs text-gray-600">
              Pause migration when errors occur instead of continuing
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Migration Estimates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Migration Estimates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {getEstimatedTime()}min
              </div>
              <div className="text-xs text-gray-600">Est. Time per User</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold">
                <Badge 
                  variant={
                    getRiskLevel() === 'high' ? 'destructive' : 
                    getRiskLevel() === 'low' ? 'default' : 'secondary'
                  }
                >
                  {getRiskLevel().toUpperCase()}
                </Badge>
              </div>
              <div className="text-xs text-gray-600">Risk Level</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {localOptions.maxConcurrentUsers || 10}
              </div>
              <div className="text-xs text-gray-600">Parallel Users</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Presets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOptionsChange({
                prioritizeSpeed: true,
                prioritizeReliability: false,
                maxConcurrentUsers: 20,
                deltaMode: false,
                dryRun: false,
                pauseOnError: false,
              })}
              disabled={disabled}
            >
              <Zap className="h-4 w-4 mr-1" />
              Fast
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOptionsChange({
                prioritizeSpeed: false,
                prioritizeReliability: true,
                maxConcurrentUsers: 5,
                deltaMode: false,
                dryRun: false,
                pauseOnError: true,
              })}
              disabled={disabled}
            >
              <Shield className="h-4 w-4 mr-1" />
              Safe
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOptionsChange({
                prioritizeSpeed: false,
                prioritizeReliability: true,
                maxConcurrentUsers: 10,
                deltaMode: false,
                dryRun: true,
                pauseOnError: true,
              })}
              disabled={disabled}
            >
              <Play className="h-4 w-4 mr-1" />
              Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
