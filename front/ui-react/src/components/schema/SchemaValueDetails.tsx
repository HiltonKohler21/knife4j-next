import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;
const ENUM_PREVIEW_COUNT = 3;

export interface SchemaValueDetailsProps {
  enum?: unknown[];
  default?: unknown;
}

export default function SchemaValueDetails({ enum: values, default: defaultValue }: SchemaValueDetailsProps) {
  const { t } = useTranslation();
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
            <details>
              <summary style={{ cursor: 'pointer' }}>
                {t('schema.values.enum')}
                {renderValues(enumValues.slice(0, ENUM_PREVIEW_COUNT))} …{' '}
                <Text type="secondary">{t('schema.values.showAll', { count: enumValues.length })}</Text>
              </summary>
              <div>{renderValues(enumValues)}</div>
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
