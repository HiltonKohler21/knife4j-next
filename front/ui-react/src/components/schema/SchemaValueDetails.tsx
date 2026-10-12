import { Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;
const ENUM_PREVIEW_COUNT = 3;

export interface SchemaValueDetailsProps {
  enum?: unknown[];
  default?: unknown;
}

export default function SchemaValueDetails({ enum: values, default: defaultValue }: SchemaValueDetailsProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if ((!values || values.length === 0) && defaultValue === undefined) return null;
  const enumValues = values?.map((value) => JSON.stringify(value));
  const renderValues = (items: (string | undefined)[]) =>
    items.map((value, index) => (
      <span key={index}>
        {index > 0 && ', '}
        <Text code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {value}
        </Text>
      </span>
    ));
  const style = { display: 'block', overflowWrap: 'anywhere' as const };

  return (
    <>
      {enumValues && enumValues.length > 0 && (
        <div style={style}>
          {enumValues.length > ENUM_PREVIEW_COUNT ? (
            <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
              <summary style={{ cursor: 'pointer' }}>
                {t('schema.values.enum')}
                {renderValues(expanded ? enumValues : enumValues.slice(0, ENUM_PREVIEW_COUNT))}
                {expanded ? ' ' : ' … '}
                <Text type="secondary">
                  {expanded ? t('schema.values.collapse') : t('schema.values.showAll', { count: enumValues.length })}
                </Text>
              </summary>
            </details>
          ) : (
            <>
              {t('schema.values.enum')}
              {renderValues(enumValues)}
            </>
          )}
        </div>
      )}
      {defaultValue !== undefined && (
        <div style={style}>
          {t('schema.values.default')}
          <Text code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(defaultValue)}
          </Text>
        </div>
      )}
    </>
  );
}
