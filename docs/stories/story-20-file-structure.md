Story: Change file structure and names of certain folders
Goal: Make it easier to find the right file for the right part of the site by colocating files with their proper page or component.
What this means in practice: Change the names of directories to be more meaningful; change the names of files to be consistent with other like files; remove directories that aren't colocated.

Important:

1. Read through this entire story first and consider if anything raises questions or adds confusion. If so, stop work and ask about it.
2. If you proceed with making changes, be sure that linkages don't break. If we change the name of a file from oldname.ts to newname.ts, we need to change every import or reference in docs to reflect the name change as well.

Details.
Please create a file structure that is based on this arrangement of folders:
/src
/components
/dev
/layouts
/pages
/about
about.astro
/home
index.astro
/chapters
/01-intro
/02-about
/03-services
/04-timeline
/work-browse (new name)
browse.astro
projects-data.ts (formerly /data/projects.ts)
/work-detail (this will display the project detail pages for each work project)
/global-scripts (formerly /src/scripts)
/styles

Move files that are in /src/config so they are colocated and use consistent name, "config", for each file.
browse.ts -> /pages/work-browse/config.ts
octagon.ts -> components/background/config.ts
page-transition.ts -> components/page-transition/config.ts
pages.ts -> components/pages/config.ts
scroll.ts -> I'm not sure -- does this belong in home page? Or does it belong generally to pages? Or something else?

Move scripts out of /src/motion so they are colocated; use consistent name
I've renamed many of these "motion.script" for consistency. If a file handles motion for a page or a component it should be collocated with that page or component and have the name motion-script. If this logic applies to every one of the following files, please change the names to "motion-script" as well. For example, perhaps engine.ts should be in a component called scroll-engine with the name motion-script.ts
about.script.ts -> pages/about/motion.script.ts
beat-model.ts -> components/beat-model/motion.script.ts
engine.ts -> components/scroll-engine/motion-script.ts
home.script.ts -> pages/home/motion.script.ts
octagon.ts -> components/background/motion-script.ts
page-init -> global-scripts/page-init.ts (I don't know where else to put this; open to suggestions)
page-script -> components/pages/motion-script.ts
page-transitions -> components/page-transitions/motion-script.ts
presets -> components/beats/motion-script.ts
timeline-kit -> components/timeline/motion-script.ts
work.script -> pages/work/motion-script.ts

Finally, remove unneeded directories.
Remove:
/src/assets (because we only need logo in /public)
/src/data (files go elsewhere)
/src/chapters because all the content will be moved into /pages.
/src/config (files go elsewhere)
/src/motion (files go elsewhere)
