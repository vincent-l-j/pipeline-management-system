export default function PageHeader({ title, description, action }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-navy-500">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
