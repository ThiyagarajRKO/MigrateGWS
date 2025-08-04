import React from 'react';

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value,
  onValueChange,
  children,
  className
}) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue || '');

  const currentValue = value || activeTab;

  const handleTabChange = (newValue: string) => {
    setActiveTab(newValue);
    onValueChange?.(newValue);
  };

  return (
    <div className={className || ''}>
      {React.Children.map(children, (child, index) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, { 
              key: index, 
              currentValue, 
              onTabChange: handleTabChange 
            })
          : child
      )}
    </div>
  );
};

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
  currentValue?: string;
  onTabChange?: (value: string) => void;
}

export const TabsList: React.FC<TabsListProps> = ({ children, className, currentValue, onTabChange }) => (
  <div className={`flex border-b border-gray-200 ${className || ''}`}>
    {React.Children.map(children, (child, index) =>
      React.isValidElement(child)
        ? React.cloneElement(child as React.ReactElement<any>, { 
            key: index,
            currentValue, 
            onTabChange 
          })
        : child
    )}
  </div>
);

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  currentValue?: string;
  onTabChange?: (value: string) => void;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  className,
  currentValue,
  onTabChange
}) => {
  const isActive = currentValue === value;

  return (
    <button
      onClick={() => onTabChange?.(value)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      } ${className || ''}`}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  currentValue?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className,
  currentValue
}) => {
  if (currentValue !== value) return null;

  return (
    <div className={`mt-4 ${className || ''}`}>
      {children}
    </div>
  );
};
