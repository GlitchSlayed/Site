# %% [markdown]
# # Before the Metal Is Cut
# ## A reproducible study of a single-lug actuator bracket
# 
# **Vansh Datta · Aerospace simulation notebook 01 · 16 November 2026**
# 
# The engineering question is deliberately specific: **can a compact 7075 aluminum
# bracket carry a 2 kN downward load and remain sufficiently stiff under a 500 N
# side load, and what does changing the root fillet actually buy?**
# 
# This is a hypothetical ground-test bracket, not a drawing from Arkwin or a part
# approved for flight. It combines hand calculations, exact nominal CAD, an
# inspectable Python solid-element solver, numerical verification, mesh refinement,
# and a three-radius study. The code and this initial analysis were developed with
# coding assistance; independent reproduction in CalculiX is an explicit next step.
# 
# **Evidence boundary:** the saved results are actual linear-elastic Python FEA runs.
# No CalculiX run, bolted-joint contact analysis, physical test, fatigue life, buckling
# capacity, or modal result is represented as completed. A numerical gate can fail;
# the notebook reports its result rather than declaring every mesh converged.
# 
# **Reading path:** specification → hand checks → finite-element formulation →
# verification → results → convergence → design tradeoff → reproduction.

# %% [markdown]
# ### 1. Reproduction and provenance
# 
# Extract the complete project ZIP, open this notebook in that folder, and run the
# cells in order. Ordinary analysis uses NumPy, SciPy, pandas, and Matplotlib.
# CadQuery is needed only to regenerate STEP files. The HTML version contains its
# figures, equations, tables, and code and can be embedded as a static page.
# 
# `RUN_SOLID = False` reuses the included, genuinely executed solid-model results.
# Set it to `True` to rebuild the recorded mesh series; this may take several minutes
# and several GB of RAM. There are no fabricated example rows. Missing cached data
# raise an error with instructions. The solver source and data hashes are checked.

# %%
from pathlib import Path
import hashlib, json, platform
import numpy as np
import pandas as pd
import scipy
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from solid_fem import bracket_mesh, boundary, verification

ROOT = Path.cwd()
RUN_SOLID = False
if RUN_SOLID:
    from run_study import run
    run()
required = ROOT / 'results/run_manifest.json'
if not required.exists():
    raise FileNotFoundError('Extract the complete project ZIP, or set RUN_SOLID=True.')
manifest = json.loads(required.read_text())
assert hashlib.sha256((ROOT/'solid_fem.py').read_bytes()).hexdigest() == manifest['solver_sha256']
for name, digest in manifest['files'].items():
    assert hashlib.sha256((ROOT/'results'/name).read_bytes()).hexdigest() == digest, name
records = []
for path in sorted((ROOT/'results').glob('r*_h*.json')):
    records.extend(json.loads(path.read_text()))
df = pd.DataFrame(records)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,
                     'axes.spines.right':False,'figure.facecolor':'#fbfaf6','axes.facecolor':'#fbfaf6',
                     'axes.labelcolor':'#233b43','text.color':'#233b43','savefig.facecolor':'#fbfaf6'})
COLORS = ['#176b79','#c1683f','#82639a']
def figure(name):
    plt.savefig(ROOT/'figures'/name, dpi=170, bbox_inches='tight')
    plt.show()
print('Recorded environment:', manifest['python'], 'NumPy', manifest['numpy'], 'SciPy', manifest['scipy'])
print('Current environment: ', platform.python_version(), 'NumPy', np.__version__, 'SciPy', scipy.__version__)
print('Solver and result hashes verified. Loaded',len(df),'load-case records.')

# %% [markdown]
# ### 2. Define the hardware before defining the mesh
# 
# The concept is a **single central lug**, captured between the two ears of a mating
# fork. It is not itself a two-ear clevis. A retained 12 mm pin transfers the downward
# load through the bore. A collar or washer transfers the axial-to-pin side load onto
# the web face. The mating fork, pin, collar, and four bolts are outside this model.
# 
# Coordinates are right-handed: **x** spans the 100 mm base length and 40 mm web width;
# **y** spans the 60 mm base width and 8 mm web thickness; **z** points up from the base
# underside. Every dimension below is nominal and in mm. No fit or machining
# tolerance has been assigned.
# 
# | Feature | Definition |
# | --- | --- |
# | Base | x = −50…50; y = −30…30; z = 0…6 |
# | Upright web | x = −20…20; y = −4…4; z = 6…66 |
# | Lug bore | Diameter 12; center (0, 0, 48); axis parallel to y |
# | Bolt clearance bores | Diameter 6.6; axes parallel to z; centers (±38, ±20) |
# | Root fillets | Two concave cylindrical blends, parallel to x, between web and base |
# | Baseline / variants | r = 5 mm baseline; r = 2 and 10 mm variants |
# | Nominal alloy | 7075-T651 plate, machined as a single piece |
# | Interfaces | Fixed bolt-bore surfaces; base underside otherwise traction-free |
# 
# The material is changed from the draft's generic T6 description to **T651 plate**
# to make the proposed stock form explicit. The CAD geometry has square web ends and
# sharp bore entrances. Those idealizations create local stress concerns and are
# not an instruction to machine unbroken edges.
# 
# **Chosen study targets, not externally supplied requirements:** mass below 160 g;
# load-weighted displacement below 0.05 mm for the 2 kN downward case and below
# 0.15 mm for the 500 N side case. These targets create a useful stiffness tradeoff.
# They do not demonstrate compatibility with a real actuator.

# %%
E, nu, rho = 71000.0, 0.33, 0.00281  # N/mm², dimensionless, g/mm³
Sy_typ, Su_typ, tau_u_typ = 503.0, 572.0, 331.0  # typical T651 values, MPa
P, Q, ultimate_factor = 2000.0, 500.0, 1.5
b, t, D, H = 40.0, 8.0, 12.0, 42.0  # H from base top to hole center
def nominal_volume(r):
    return 100*60*6 - 4*np.pi*3.3**2*6 + b*t*60 - np.pi*(D/2)**2*t + 2*b*r*r*(1-np.pi/4)
design = pd.DataFrame({'radius_mm':[2,5,10]})
design['exact_volume_mm3'] = design.radius_mm.map(nominal_volume)
design['mass_g'] = design.exact_volume_mm3*rho
display(design.round(3))

pgeo,tgeo = bracket_mesh(6,5)
fgeo,_ = boundary(tgeo)
fig=plt.figure(figsize=(12,5.5))
ax=fig.add_subplot(121,projection='3d')
mesh=Poly3DCollection(pgeo[fgeo],facecolor='#8db1b5',edgecolor='#567b83',linewidth=.12,alpha=.95)
ax.add_collection3d(mesh)
ax.set(xlim=(-55,55),ylim=(-35,35),zlim=(0,78),xlabel='x [mm]',ylabel='y [mm]',zlabel='z [mm]')
ax.set_box_aspect((100,60,75));ax.view_init(22,-57)
ax.quiver(0,0,76,0,0,-20,color=COLORS[1],arrow_length_ratio=.25,linewidth=2)
ax.quiver(0,-28,48,0,18,0,color=COLORS[2],arrow_length_ratio=.25,linewidth=2)
ax.set_title('Nominal bracket • r = 5 mm\nDownward load at bore; side load at collar face')
ax2=fig.add_subplot(122)
from matplotlib.patches import Rectangle, Circle, Arc
ax2.add_patch(Rectangle((-50,0),100,6,fill=False,lw=1.8,edgecolor=COLORS[0]))
ax2.add_patch(Rectangle((-20,6),40,60,fill=False,lw=1.8,edgecolor=COLORS[0]))
ax2.add_patch(Circle((0,48),6,fill=False,lw=1.8,edgecolor=COLORS[1]))
ax2.annotate('2,000 N',(0,42),(24,47),arrowprops={'arrowstyle':'->'},color=COLORS[1])
ax2.annotate('Ø12 bore',(0,54),(-45,76),arrowprops={'arrowstyle':'->'})
ax2.annotate('40 mm web',(0,66),(25,69),arrowprops={'arrowstyle':'->'})
ax2.annotate('6 mm base',(42,3),(24,-15),arrowprops={'arrowstyle':'->'})
ax2.text(-47,12,'Pin axis: y\nLoad height above base: 42 mm',fontsize=9)
ax2.set(xlim=(-58,58),ylim=(-20,83),xlabel='x [mm]',ylabel='z [mm]',title='Front elevation • nominal dimensions')
ax2.set_aspect('equal');ax2.grid(alpha=.15)
fig.tight_layout();figure('bracket_geometry.png')

# %% [markdown]
# ### 3. Material inputs and the meaning of a margin
# 
# Kaiser's [7075 plate technical data](https://online.kaiseraluminum.com/depot/PublicProductInformation/Document/1017/Kaiser_Aluminum_7075_Sheet_Coil_and_Plate.pdf)
# lists typical T651 tensile yield and ultimate strengths of 503 and 572 MPa,
# ultimate shear strength of 331 MPa, and elastic modulus of 71 GPa. This notebook
# uses those typical values for educational screening. Poisson ratio 0.33 and density
# 2810 kg/m³ are declared modeling assumptions.
# 
# These are **not thickness-, orientation-, and procurement-specific design
# allowables**. The final choice of plate and the material certificate could change
# the strength inputs. We do not equate tensile yield strength to bearing strength,
# and we do not turn a typical fatigue value into a life prediction.
# 
# For a specified stress quantity and an applicable allowable, the margin is
# 
# $$MS = \frac{S_{allow}}{\sigma_{demand}}-1$$
# 
# A positive number is meaningful only if both terms represent the same failure
# mode. Comparing a local von Mises stress with tensile yield is an elastic yield
# screen. It is not a lug bearing allowable, a bolt check, or proof of ultimate load
# capacity. The 1.5 factor is selected for this exercise, not claimed as compliance
# with a particular regulation.

# %% [markdown]
# ### 4. Hand calculations: follow the load path
# 
# **Downward case:** the pin pushes on the lower half of the bore; load travels down
# the web, through the filleted root and flexible base, and into the four constrained
# bores. Nominal bearing stress is force divided by projected bearing area:
# 
# $$p_b=\frac{P}{Dt}$$
# 
# The straight web below the hole carries gross compressive stress approximately
# P/(bt). A hypothetical upward/reversed load would instead make the top ligament,
# net-section tension, and tear-out screens relevant. For that separate screening
# direction, the top-edge center distance is e = 18 mm:
# 
# $$\sigma_{net}=\frac{P}{(b-D)t},\qquad \tau_{tear}=\frac{P}{2t(e-D/2)}$$
# 
# Those two formulas are **not a tensile failure assessment of the current downward
# case**. A true reverse-load FEA must move the bearing pressure onto the upper half
# of the bore; simply negating the existing contact-pressure traction is unphysical.
# 
# For a 12 mm pin supported by the mating fork in ideal double shear:
# 
# $$\tau_{pin}=\frac{P}{2(\pi D^2/4)}$$
# 
# This excludes pin bending, clearance, nonuniform bearing, and pin material selection.

# %%
e = 18.0
hand = pd.DataFrame([
    ['Lug projected bearing, downward',P/(D*t),'MPa','Demand only; no bearing allowable assigned'],
    ['Gross web compression, downward',P/(b*t),'MPa','Away from hole/root; ignores base compliance'],
    ['Net section, hypothetical reverse load',P/((b-D)*t),'MPa','Separate load-direction screen'],
    ['Top ligament tear-out, hypothetical reverse',P/(2*t*(e-D/2)),'MPa','Nominal two-plane average; not an allowable'],
    ['Pin shear, ideal double shear',P/(2*np.pi*D**2/4),'MPa','Fork and pin not included in solid model'],
],columns=['quantity','value','unit','interpretation'])
display(hand.round(3))

# %% [markdown]
# ### 5. Why the smaller load is more demanding
# 
# The side load bends the web about its thin direction. Treating it as a rectangular
# cantilever with height H = 42 mm gives
# 
# $$I_x=\frac{bt^3}{12},\quad M_x=QH,\quad \sigma_b=\frac{M_x(t/2)}{I_x},\quad \delta_y=\frac{QH^3}{3EI_x}$$
# 
# The thickness is cubed in the stiffness. A modest change in thickness can matter
# more than a large increase in tensile strength. A fillet can reduce local stress
# and stiffen the root, but it does not turn the web into a different alloy.
# 
# For comparison, straight-web shortening under the downward load is
# 
# $$\delta_z=\frac{PH}{Ebt}$$
# 
# These are deliberately reduced models. They omit the hole, collar footprint,
# fillet, base bending, and elastic support compliance. Expect the solid model to
# differ. They test scale and load-path interpretation, not exact equality.

# %%
I = b*t**3/12
M = Q*H
sigma_b = M*(t/2)/I
delta_side = Q*H**3/(3*E*I)
delta_down = P*H/(E*b*t)
shear_side = Q*H/((5/6)*(E/(2*(1+nu)))*b*t)
bolt_couple = Q*48/40  # global base moment / y-row spacing
display(pd.DataFrame([
    ['Web second moment',I,'mm⁴'],['Root bending moment (base top)',M,'N·mm'],
    ['Nominal web bending stress',sigma_b,'MPa'],['Web-only bending displacement',delta_side,'mm'],
    ['Web-only shear displacement estimate',shear_side,'mm'],['Web-only axial shortening',delta_down,'mm'],
    ['Side-load global overturning moment',Q*48,'N·mm'],
    ['Ideal row force couple across 40 mm',bolt_couple,'N per row'],
    ['Ideal two-bolt share in one row',bolt_couple/2,'N per bolt']
],columns=['quantity','value','unit']).round(5))
ts=np.linspace(5,12,100)
fig,axs=plt.subplots(1,2,figsize=(11,3.8))
axs[0].plot(ts,Q*H**3/(3*E*(b*ts**3/12)),color=COLORS[0]);axs[0].axvline(t,color=COLORS[1],ls='--')
axs[0].set(xlabel='Web thickness [mm]',ylabel='Web-only deflection [mm]',title='Analytical sensitivity • 500 N side load')
axs[1].plot(ts,6*Q*H/(b*ts**2),color=COLORS[1]);axs[1].axvline(t,color=COLORS[0],ls='--')
axs[1].set(xlabel='Web thickness [mm]',ylabel='Nominal bending stress [MPa]',title='A screening sweep, not a solid-model optimization')
for ax in axs:ax.grid(alpha=.2)
fig.tight_layout();figure('thickness_sensitivity.png')

# %% [markdown]
# ### 6. Loads and constraints in the solid model
# 
# **LC1: downward limit, 2,000 N.** Let the outward radial direction from the hole
# center into the lug material be e_r, with z component e_rz. A cosine bearing traction
# acts only on the lower half of the bore:
# 
# $$\mathbf{t}=p_0\max(0,-e_{rz})\mathbf{e}_r,\qquad p_0=\frac{2P}{\pi Rt}$$
# 
# The analytical normalization above applies to the exact cylindrical surface. The
# implementation integrates on faceted faces and normalizes the assembled nodal
# loads to exactly −2,000 N in z. It also records the small quadrature-induced
# off-axis moments instead of silently assuming perfect symmetry.
# 
# **LC2: side limit, 500 N in +y.** A smooth annular pressure acts on the y = −4 mm
# face, centered on the hole. Its radial weighting is sin²[π(R−6)/6] for 6 < R < 12 mm
# and zero elsewhere, normalized to a total of 500 N. This represents a retained
# pin collar spreading thrust onto the face. It is a prescribed traction surrogate,
# not a solved washer contact pressure.
# 
# **LC3: downward factored, 3,000 N.** In this small-displacement, linear-elastic
# model the displacement and stress fields scale exactly by 1.5, and strain energy
# by 2.25. LC3 is calculated by scaling LC1; it is not falsely presented as a separate
# nonlinear ultimate-strength simulation.
# 
# All displacement components on the four bolt-bore surfaces are fixed. The base
# underside is free. This is a deliberately stiff, idealized support model, not a
# faithful substitute for bolts, preload, contact, friction, or a mating plate.
# Support-edge peaks can be singular. The scenarios are separate, not simultaneous;
# a combined loading assessment is part of the agent handoff.

# %% [markdown]
# ### 7. An inspectable finite-element formulation
# 
# The governing equations are small-strain isotropic elasticity with no body force:
# 
# $$\nabla\cdot\boldsymbol{\sigma}=0,\quad \boldsymbol{\varepsilon}=\frac{\nabla\mathbf{u}+\nabla\mathbf{u}^{T}}{2},\quad \boldsymbol{\sigma}=\lambda\,\mathrm{tr}(\boldsymbol{\varepsilon})\mathbf{I}+2\mu\boldsymbol{\varepsilon}$$
# 
# The weak form leads to element stiffness and the assembled linear system:
# 
# $$\mathbf{K}_e=\int_{V_e}\mathbf{B}^{T}\mathbf{C}\mathbf{B}\,dV,\qquad \mathbf{K}\mathbf{u}=\mathbf{f}$$
# 
# The code uses ten-node tetrahedra with quadratic Lagrange displacement fields:
# 
# $$N_i=L_i(2L_i-1),\qquad N_{ij}=4L_iL_j$$
# 
# Geometry is **affine within each tetrahedron**: curved bores and fillets are
# represented by flat faces, and midside nodes lie at edge midpoints. Thus geometry
# error decreases with refinement along with displacement error. This is not a
# curved isoparametric mesh. Four tetrahedral integration points exactly integrate
# the quadratic stiffness integrand for homogeneous material on affine elements.
# Seven-point, degree-five triangle quadrature integrates applied surface loads.
# 
# The sparse system is solved with diagonally preconditioned conjugate gradients.
# Engineering shear strain is used in the strain vector. Stresses are unaveraged;
# the plotted whole-part field uses element-centroid stress, while the fillet
# measurement evaluates stress at boundary-face centroids in a defined region.
# 
# The source below is included for inspection. `solid_fem.py` is the executable
# version; do not edit the displayed copy without also updating the source file and
# rerunning the study. This custom solver is a learning tool, which makes independent
# verification and the later CalculiX comparison especially important.

# %%
# Inspect the implementation used for the recorded results.
import inspect, solid_fem
print(inspect.getsource(solid_fem.constitutive))
print(inspect.getsource(solid_fem.strain_matrix))
print(inspect.getsource(solid_fem.assemble))

# %% [markdown]
# ### 8. Verification before interpreting the bracket
# 
# The independent beam benchmark is a rectangular cantilever: L = 200 mm, width =
# 20 mm, thickness = 10 mm, E = 71,000 MPa, ν = 0.33, and a uniformly distributed
# 100 N transverse force on its end face. Its Euler–Bernoulli reference is
# 
# $$\delta_{tip}=\frac{FL^3}{3EI},\qquad I=\frac{20(10)^3}{12}$$
# 
# The measured FE output is the end-face force-weighted displacement. Full 3D
# clamping and Poisson effects differ from the beam theory assumptions, so this is
# an approximate benchmark, not an exact continuum solution. The acceptance band
# is 2% for this starter check. A closer study would refine the beam itself and
# compare away from its clamped boundary.
# 
# Three additional checks exercise different failure modes in the implementation:
# the element must reproduce a constant strain, all six rigid motions must have
# negligible elastic energy, and an affine displacement prescribed on the entire
# boundary must be recovered by solving for the interior nodes. Force balance,
# moment balance, energy, and free-DOF residuals are checked on every bracket solve.

# %%
checks = verification()  # actually rerun the independent small benchmark
display(pd.DataFrame(checks.items(),columns=['check','value']))
print('Beam agreement:',f"{checks['beam_error_pct']:+.3f}%",'relative to Euler–Bernoulli.')
fig,ax=plt.subplots(figsize=(8,3.3))
ax.barh(['Euler–Bernoulli','3D Python FEM'],[checks['beam_reference_mm'],checks['beam_fem_mm']],color=COLORS[:2])
ax.set(xlabel='Tip displacement magnitude [mm]',title='Verification case • 200 × 20 × 10 mm cantilever, 100 N')
for i,v in enumerate([checks['beam_reference_mm'],checks['beam_fem_mm']]):ax.text(v+.025,i,f'{v:.4f}',va='center')
ax.set_xlim(0,2.6);fig.tight_layout();figure('beam_verification.png')

# %% [markdown]
# ### 9. Quantities of interest: define them before seeing the contours
# 
# The displacement measure is work-conjugate to the applied load distribution:
# 
# $$\delta_F=\frac{\mathbf{f}^{T}\mathbf{u}}{|\mathbf{F}|}$$
# 
# It is the generalized displacement under the chosen distributed loading, not a
# node selected after looking at the result. LC1 includes small radial displacements
# weighted by the radial bearing traction. LC2 is a pressure-weighted y displacement
# on the collar. Maximum nodal displacement is reported separately; the two
# quantities do not necessarily occur at the same location.
# 
# The fillet metric is the maximum unaveraged von Mises stress at boundary triangle
# centroids on **both root fillets, within |x| < 6 mm**, excluding their end edges.
# The area-weighted mean over that patch is also recorded. This removes sharp fillet
# terminations from the selected metric, but does not establish a part-wide maximum
# stress or prove that all local singularities are absent. The centroid-based peak
# is a sampled quantity whose sampling changes with mesh density.
# 
# $$\sigma_{VM}=\sqrt{\frac{(\sigma_x-\sigma_y)^2+(\sigma_y-\sigma_z)^2+(\sigma_z-\sigma_x)^2}{2}+3(\tau_{xy}^2+\tau_{yz}^2+\tau_{zx}^2)}$$

# %%
fine = df[np.isclose(df.h_mm,2)].copy()
baseline = fine[np.isclose(fine.r_mm,5)].copy()
columns=['case','elements','dofs','displacement_work_mm','max_displacement_mm',
         'fillet_vm_max_MPa','fillet_vm_area_mean_MPa','global_centroid_vm_max_MPa']
display(baseline[columns].round(5))
d=baseline.set_index('case')
ratio=d.loc['side_limit','displacement_work_mm']/d.loc['down_limit','displacement_work_mm']
print(f'The 500 N side load gives {ratio:.2f} times the generalized displacement of the 2,000 N downward load.')
print('Global centroid stress maxima are diagnostics, NOT convergence-qualified allowables checks.')
display(baseline[['case','force_balance_error','moment_balance_error','energy_error','relative_free_residual','iterations']])

# %% [markdown]
# ### 10. Contours are evidence only when their conditions are visible
# 
# Both plots below use the r = 5 mm bracket and h = 2 mm requested bulk spacing.
# Colors show the unaveraged centroid stress of the tetrahedron adjacent to each
# visible surface triangle. This is deliberately a coarse display of the stress
# field, not a smoothed nodal stress extrapolation. The shared color scale clips at
# the larger 99th percentile of the two surface samples; higher values use the top
# color. The preceding table retains the unclipped centroid maximum.
# 
# The side-load deformation view is magnified by a stated factor for readability.
# A magnified deformation image must not be mistaken for the actual displacement.

# %%
data=np.load(ROOT/'results/r5_h2.npz')
p,faces,owners=data['p'],data['faces'],data['owner']
limits=[np.percentile(data[c+'_vm'][owners],99) for c in ['down_limit','side_limit']]
vmax=max(limits);norm=Normalize(0,vmax);cmap=plt.get_cmap('magma')
fig=plt.figure(figsize=(12,5.2))
for i,(case,label) in enumerate([('down_limit','2,000 N downward'),('side_limit','500 N sideways')]):
    ax=fig.add_subplot(1,2,i+1,projection='3d')
    colors=cmap(norm(data[case+'_vm'][owners]))
    ax.add_collection3d(Poly3DCollection(p[faces],facecolors=colors,edgecolor='none'))
    ax.set(xlim=(-50,50),ylim=(-30,30),zlim=(0,70),xlabel='x [mm]',ylabel='y [mm]',zlabel='z [mm]',title=label)
    ax.set_box_aspect((100,60,70));ax.view_init(25,-58)
sm=plt.cm.ScalarMappable(norm=norm,cmap=cmap)
fig.colorbar(sm,ax=fig.axes,shrink=.65,pad=.06,extend='max',label='Element-centroid von Mises stress [MPa]')
figure('stress_comparison.png')

u=data['side_limit_u'].reshape(-1,3);scale=40
fig=plt.figure(figsize=(8,5.6));ax=fig.add_subplot(111,projection='3d')
ax.add_collection3d(Poly3DCollection(p[faces],facecolor='#aab9b9',alpha=.16,edgecolor='none'))
ax.add_collection3d(Poly3DCollection((p+scale*u)[faces],facecolor=COLORS[0],alpha=.8,edgecolor='none'))
ax.set(xlim=(-50,50),ylim=(-30,40),zlim=(0,70),xlabel='x [mm]',ylabel='y [mm]',zlabel='z [mm]',
       title=f'500 N side load • deformation magnified {scale}×\nGrey: undeformed; teal: deformed')
ax.set_box_aspect((100,70,70));ax.view_init(13,-5)
figure('side_deformation.png')

# %% [markdown]
# ### 11. Mesh refinement: a displacement can settle before the stress does
# 
# The baseline uses requested bulk spacings of 6, 4.5, 3, and 2 mm. Local feature
# breaks override that spacing: each fillet gets at least three angular subdivisions,
# and progressively more as h falls. Exact element counts are reported. Circular
# holes and fillets are faceted, so this is combined geometry and discretization
# refinement rather than pure polynomial error isolation.
# 
# For each quantity q, the relative change between adjacent refinements is
# 
# $$\eta_q=\frac{|q_{fine}-q_{coarse}|}{|q_{fine}|}\times100\%$$
# 
# The predeclared gate is **less than 2% change in both generalized displacement and
# the selected fillet stress**, separately for each load case. This is an engineering
# stability check, not an estimated bound on the true error. The refinement ratio
# is not uniform, and stress sampling changes, so no Richardson extrapolation or
# Grid Convergence Index is claimed.

# %%
convergence=[]
for case in ['down_limit','side_limit']:
    s=df[(df.r_mm==5)&(df.case==case)].sort_values('h_mm',ascending=False).copy()
    for col,short in [('displacement_work_mm','displacement'),('fillet_vm_max_MPa','stress')]:
        s[short+'_change_pct']=100*s[col].diff().abs()/s[col].abs()
    convergence.append(s)
conv=pd.concat(convergence)
display(conv[['case','h_mm','elements','dofs','displacement_work_mm','fillet_vm_max_MPa',
              'displacement_change_pct','stress_change_pct']].round(4))
gate=conv[conv.h_mm==2][['case','displacement_change_pct','stress_change_pct']].copy()
gate['both_below_2pct']=(gate.displacement_change_pct<2)&(gate.stress_change_pct<2)
display(gate)
fig,axs=plt.subplots(1,2,figsize=(11,4))
for color,case in zip(COLORS,['down_limit','side_limit']):
    s=conv[conv.case==case]
    axs[0].plot(s.elements,s.displacement_work_mm,'o-',color=color,label=case)
    axs[1].plot(s.elements,s.fillet_vm_max_MPa,'o-',color=color,label=case)
axs[0].set(ylabel='Generalized displacement [mm]',title='Displacement refinement')
axs[1].set(ylabel='Sampled fillet von Mises stress [MPa]',title='Stress refinement • same defined region')
for ax in axs:ax.set_xlabel('Number of tetrahedra');ax.grid(alpha=.2);ax.legend()
fig.tight_layout();figure('mesh_convergence.png')

# %% [markdown]
# ### 12. The fillet is a design variable, not a cosmetic feature
# 
# The radius comparison keeps all other nominal dimensions and load definitions
# fixed. Each of r = 2, 5, and 10 mm has h = 3 and 2 mm runs. Compare mass from the
# exact analytical geometry with response from the finest recorded mesh. The two
# variant meshes are a sensitivity check, not an automatic claim of converged peak
# stress for every geometry.
# 
# A larger radius changes both the stress flow and the effective root restraint.
# Therefore its effect on stiffness should be measured, not inferred solely from a
# stress-concentration chart. It also adds material and requires more machining
# clearance near the mounting interfaces.

# %%
trade=fine[fine.case=='side_limit'].sort_values('r_mm').copy()
trade['nominal_mass_g']=trade.r_mm.map(nominal_volume)*rho
trade['side_target_pass']=trade.displacement_work_mm<.15
trade['mass_target_pass']=trade.nominal_mass_g<160
changes=[]
for r in [2,5,10]:
    s=df[(df.r_mm==r)&(df.case=='side_limit')].set_index('h_mm')
    changes.append(100*abs(s.loc[2,'fillet_vm_max_MPa']-s.loc[3,'fillet_vm_max_MPa'])/s.loc[2,'fillet_vm_max_MPa'])
trade['side_stress_change_3_to_2_pct']=changes
display(trade[['r_mm','nominal_mass_g','displacement_work_mm','fillet_vm_max_MPa',
               'side_stress_change_3_to_2_pct','side_target_pass','mass_target_pass']].round(4))
fig,axs=plt.subplots(1,3,figsize=(12,3.5))
axs[0].plot(trade.r_mm,trade.nominal_mass_g,'o-',color=COLORS[0]);axs[0].set(ylabel='Exact nominal mass [g]',title='Material cost')
axs[1].plot(trade.r_mm,trade.displacement_work_mm,'o-',color=COLORS[1]);axs[1].axhline(.15,color='#777777',ls='--',label='Study target');axs[1].legend()
axs[1].set(ylabel='Generalized side displacement [mm]',title='Stiffness benefit')
axs[2].plot(trade.r_mm,trade.fillet_vm_max_MPa,'o-',color=COLORS[2]);axs[2].set(ylabel='Sampled fillet stress [MPa]',title='Local stress response')
for ax in axs:ax.set_xlabel('Root radius [mm]');ax.set_xticks([2,5,10]);ax.grid(alpha=.2)
fig.tight_layout();figure('fillet_tradeoff.png')

# %% [markdown]
# ### 13. What the results support—and what they do not
# 
# The result supports a statement about this modeled load path: the sideways load
# is more compliant because it excites bending of the thin web and its flexible
# base. The straight-web hand model underestimates the complete-bracket side
# deflection because it omits important sources of compliance. Agreement in trend
# is useful; exact agreement was never the right test here.
# 
# The 10 mm radius is a candidate for the next independent model, not a selected
# flight design. Its response must be assessed alongside convergence status,
# support assumptions, clearance around fasteners, and manufacturing constraints.
# 
# This table is only a **typical-property local yield screen**, using the selected
# fillet stress. It deliberately does not claim a part-wide factor of safety.
# It excludes bearing, pin bending, bolt strength, preload loss, fatigue, buckling,
# and fracture. If a mesh gate fails, the stress-derived number remains preliminary.

# %%
screen=baseline[['case','fillet_vm_max_MPa']].copy()
screen['typical_yield_to_local_vm_ratio']=Sy_typ/screen.fillet_vm_max_MPa
screen['local_screen_margin']=screen.typical_yield_to_local_vm_ratio-1
display(screen.round(3))
comp=pd.DataFrame([
    ['Downward',delta_down,d.loc['down_limit','displacement_work_mm']],
    ['Sideways',delta_side,d.loc['side_limit','displacement_work_mm']]
],columns=['load','straight_web_estimate_mm','complete_bracket_generalized_mm'])
display(comp.round(5))
for _,row in gate.iterrows():
    print(row['case'], 'mesh gate:', 'PASS' if row.both_below_2pct else 'NOT YET MET',
          f"(displacement {row.displacement_change_pct:.2f}%, stress {row.stress_change_pct:.2f}%)")
df.to_csv(ROOT/'results/summary.csv',index=False)
conv.to_csv(ROOT/'results/convergence.csv',index=False)
trade.to_csv(ROOT/'results/fillet_tradeoff.csv',index=False)

# %% [markdown]
# ### 14. Handoff to a production solver and a physical experiment
# 
# 1. Open the three STEP files in FreeCAD and inspect dimensions, solid validity,
#    bore axes, exact volume, and accessibility around the 10 mm fillet.
# 2. Generate independent Gmsh meshes with curved quadratic geometry where valid,
#    then solve the same loads and constraints with CalculiX C3D10 elements.
# 3. Match the load resultants, their moments, and the output definitions before
#    comparing solver results. Mesh a fillet region explicitly; do not compare one
#    program's averaged nodal peak with the other's unaveraged centroid stress.
# 4. Refine any quantity that misses the 2% gate. Compare surface sampling methods
#    and check geometric approximation separately from displacement order.
# 5. Replace the idealized support with a justified bolt/fixture/contact model.
#    Assess the collar load spread, load reversal, and any simultaneous loads.
# 6. Only then add modal analysis, a specified fatigue spectrum, or buckling as
#    separate studies. Eigenvalue buckling alone is not a collapse prediction.
# 7. A small physical test could measure displacement at a marked location under a
#    calibrated force. Model that exact fixture and sensor location before calling
#    it experimental validation. The generalized displacement above is not directly
#    a dial-indicator reading.
# 
# `Agent_Handoff.md` contains the complete CAD, solver, and site-integration task.
# The current deliverable is an executed computational baseline with its remaining
# checks exposed, not a claim that all twelve weeks have already been completed.
# 
# ### 15. References and further reading
# 
# - [Kaiser Aluminum: 7075 sheet, coil, and plate technical data](https://online.kaiseraluminum.com/depot/PublicProductInformation/Document/1017/Kaiser_Aluminum_7075_Sheet_Coil_and_Plate.pdf). Typical material values only; no procurement-specific allowable inferred.
# - [DefElement: degree-two Lagrange tetrahedron](https://defelement.org/elements/examples/tetrahedron-lagrange-equispaced-2.html). Basis definition used to check the interpolation.
# - [SciPy: conjugate-gradient solver](https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.linalg.cg.html). Solver interface and convergence semantics.
# - [Gmsh reference manual](https://gmsh.info/doc/texinfo/gmsh.html). Independent meshing workflow planned for the local reproduction.
# - [NASA NPARC: verification and validation tutorial](https://www.grc.nasa.gov/www/wind/valid/tutorial/tutorial.html). Distinguishing numerical verification from comparison with physical observations.
# - [CalculiX official project](https://www.calculix.de/). Planned independent solid solver; not the source of the recorded results in this notebook.
# 
# Geometry, loads, design targets, density, and Poisson ratio are explicitly selected
# study assumptions. All figures are generated from the accompanying calculations.
