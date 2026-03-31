import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
        {children}
      </table>
    </div>
  );
};

interface TableHeaderProps {
  children: React.ReactNode;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children }) => {
  return <thead className="bg-gray-50">{children}</thead>;
};

interface TableBodyProps {
  children: React.ReactNode;
}

export const TableBody: React.FC<TableBodyProps> = ({ children }) => {
  return <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>;
};

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  className?: string;
}

export const TableRow: React.FC<TableRowProps> = ({ children, className = '', ...props }) => {
  return <tr className={className} {...props}>{children}</tr>;
};

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  className?: string;
}

export const TableHead: React.FC<TableHeadProps> = ({ children, className = '', ...props }) => {
  return (
    <th
      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}
      {...props}
    >
      {children}
    </th>
  );
};

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  className?: string;
}

export const TableCell: React.FC<TableCellProps> = ({ children, className = '', ...props }) => {
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`} {...props}>
      {children}
    </td>
  );
};
