import DataExplorerClient from './DataExplorerClient';

export const metadata = {
  title: 'Data Explorer | Settings | Love of Minnesota',
  description: 'Browse and manage public database tables',
};

export default function DataExplorerPage() {
  return <DataExplorerClient />;
}
