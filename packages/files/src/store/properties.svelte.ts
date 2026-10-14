export const propertiesView = $state<{ paths: string[] }>({ paths: [] })

export const openProperties = (paths: string[]) => {
  propertiesView.paths = paths
}

export const closeProperties = () => {
  propertiesView.paths = []
}
